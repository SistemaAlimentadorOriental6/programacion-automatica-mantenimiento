package reports

import (
	"database/sql"
	"fmt"
	"log"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// claveVariable es la clave para el mapa de valores de variables por bus y tipo.
type claveVariable struct{ bus, tipoVar string }

// Regex para extraer el ID de tarea_abierta_posterior
var reIDTarea = regexp.MustCompile(`ID:\s*(\d+)`)

func extractID(texto string) string {
	if m := reIDTarea.FindStringSubmatch(texto); len(m) == 2 {
		return m[1]
	}
	return ""
}

type Repository interface {
	GetReporteTareas() ([]ReporteTarea, error)
	GetLubricacionReports() ([]ReporteTarea, error)
	GetDiagnosticoReports() ([]ReporteTarea, error)
	GetEngraseReports() ([]ReporteTarea, error)
	GetDetalleTareaAdmon(ids []string) ([]TareaAdmon, error)
	// Extrae el PARTE y FECHA PROPUESTA de admonDB dado un slice de tarea_abierta_posterior
	GetPartesParaExcel(tareasAbiertas []string) (map[string]DatosExcelAdmon, error)
	GetResponsables() ([]Empleado, error)
	GetTecnicos() ([]Empleado, error)
}

// ... (en la implementación)

func (r *mysqlRepository) GetEngraseReports() ([]ReporteTarea, error) {
	engraseTasks := map[string]bool{
		"LUBRICAR (ENGRASE) BUS AGRALE 8.7 CON CARROCERÍA SENIOR":  true,
		"LUBRICAR (ENGRASE) BUS DINA RUNNER 8G":                    true,
		"LUBRICAR (ENGRASE) BUS NPR REWARD CON CARROCERIA BUSSCAR": true,
	}

	query := `
		SELECT
			codigo_activo AS bus,
			tarea,
			estado_tarea AS estado,
			tarea_abierta_posterior,
			frecuencia_tarea_ultima,
			duracion_hoy_ied,
			bus_en_franja_hoy
		FROM reporte_tareas
		WHERE LOWER(estado_tarea) IN ('proxima', 'vencida')
		AND estado_bus IS NULL
		AND bus_en_franja_hoy IN ('SI', 'NO')
		AND (
			dias_en_franja_actual <= 1
			OR dias_en_franja_actual IS NULL
		);
	`
	rows, err := r.db.Query(query)
	if err != nil {
		log.Printf("[ERROR] GetEngraseReports: %v", err)
		return nil, fmt.Errorf("error al consultar reporte_tareas: %w", err)
	}
	defer rows.Close()

	var reportes []ReporteTarea
	for rows.Next() {
		var rt ReporteTarea
		var tareaAbierta, frecuenciaUltima, busEnFranja sql.NullString
		var duracionHoy sql.NullFloat64

		// El Scan debe coincidir con el número de columnas del SELECT
		if err := rows.Scan(&rt.Bus, &rt.Tarea, &rt.Estado, &tareaAbierta, &frecuenciaUltima, &duracionHoy, &busEnFranja); err != nil {
			log.Printf("[ERROR] Scan en GetEngraseReports: %v", err)
			continue
		}
		if tareaAbierta.Valid {
			rt.TareaAbiertaPosterior = tareaAbierta.String
		}
		if frecuenciaUltima.Valid {
			rt.FrecuenciaTareaUltima = frecuenciaUltima.String
		}
		if duracionHoy.Valid {
			rt.DatoHoy = fmt.Sprintf("%.0f", duracionHoy.Float64)
		}

		if engraseTasks[rt.Tarea] {
			reportes = append(reportes, rt)
		}
	}

	return r.filterOpenTasks(reportes), nil
}

type mysqlRepository struct {
	db          *sql.DB
	admonDB     *sql.DB
	variablesDB *sql.DB
}

func NewRepository(db *sql.DB, admonDB *sql.DB, variablesDB *sql.DB) Repository {
	return &mysqlRepository{db: db, admonDB: admonDB, variablesDB: variablesDB}
}

func (r *mysqlRepository) GetReporteTareas() ([]ReporteTarea, error) {
	query := `
		SELECT 
			codigo_activo as bus, 
			tarea, 
			estado_tarea as estado,
			tarea_abierta_posterior,
			frecuencia_tarea_ultima,
			duracion_hoy_ied,
			bus_en_franja_hoy
		FROM reporte_tareas
		WHERE estado_bus IS NULL
		AND bus_en_franja_hoy IN ('SI', 'NO')
		AND (
			dias_en_franja_actual <= 1
			OR dias_en_franja_actual IS NULL
		)
	`

	rows, err := r.db.Query(query)
	if err != nil {
		log.Printf("[ERROR] GetReporteTareas: %v", err)
		return nil, fmt.Errorf("error al consultar reporte_tareas: %w", err)
	}
	defer rows.Close()

	var reportes []ReporteTarea
	for rows.Next() {
		var rt ReporteTarea
		var tareaAbierta, frecuenciaUltima, busEnFranja sql.NullString
		var duracionHoy sql.NullFloat64
		if err := rows.Scan(&rt.Bus, &rt.Tarea, &rt.Estado, &tareaAbierta, &frecuenciaUltima, &duracionHoy, &busEnFranja); err != nil {
			return nil, fmt.Errorf("error al escanear fila: %w", err)
		}
		if tareaAbierta.Valid {
			rt.TareaAbiertaPosterior = tareaAbierta.String
		}
		if frecuenciaUltima.Valid {
			rt.FrecuenciaTareaUltima = frecuenciaUltima.String
		}
		if duracionHoy.Valid {
			rt.DatoHoy = fmt.Sprintf("%.0f", duracionHoy.Float64)
		}
		reportes = append(reportes, rt)
	}

	return r.filterOpenTasks(reportes), nil
}

func (r *mysqlRepository) filterOpenTasks(reportes []ReporteTarea) []ReporteTarea {
	if len(reportes) == 0 {
		return reportes
	}

	// 1. Extraer IDs únicos para consultar en Admon
	idMap := make(map[string]struct{})
	for _, rt := range reportes {
		if id := extractID(rt.TareaAbiertaPosterior); id != "" {
			idMap[id] = struct{}{}
		}
	}

	if len(idMap) == 0 {
		return reportes
	}

	// 2. Consultar cuáles de esos IDs están realmente ABIERTOS en Admon
	ids := make([]string, 0, len(idMap))
	for id := range idMap {
		ids = append(ids, id)
	}

	openIds := make(map[string]bool)
	abiertas, err := r.GetDetalleTareaAdmon(ids)
	if err != nil {
		log.Printf("[ERROR] Falló la validación contra ADMON: %v. Se procede sin filtrar para evitar bloqueo.", err)
		return reportes
	}

	for _, t := range abiertas {
		openIds[t.IDTareaGenerada] = true
	}

	// 3. Filtrar la lista original: solo mantenemos las que tienen ID Abierto o no tienen ID (casos raros)
	var filtrados []ReporteTarea
	for _, rt := range reportes {
		id := extractID(rt.TareaAbiertaPosterior)
		// Si tiene ID, debe estar en openIds. Si no tiene ID, lo dejamos pasar por ahora.
		if id == "" || openIds[id] {
			filtrados = append(filtrados, rt)
		}
	}

	return filtrados
}

func (r *mysqlRepository) GetLubricacionReports() ([]ReporteTarea, error) {
	// 1. Obtener todos los buses y sus nombres desde Admon para clasificar
	admonQuery := "SELECT codigo_activo, nombre_activo FROM informacion_activos WHERE codigo_activo LIKE '%BUS%'"
	admonRows, err := r.admonDB.Query(admonQuery)
	if err != nil {
		log.Printf("[ERROR] GetLubricacionReports (admonDB): %v", err)
		return nil, fmt.Errorf("error al consultar tipologia en admonDB: %w", err)
	}
	defer admonRows.Close()

	busTypes := make(map[string]string)
	for admonRows.Next() {
		var code, name string
		if err := admonRows.Scan(&code, &name); err == nil {
			nameUpper := strings.ToUpper(name)
			if strings.Contains(nameUpper, "DINA RUNNER") {
				busTypes[code] = "RUNNER"
			} else if strings.Contains(nameUpper, "NPR") {
				busTypes[code] = "NPR"
			} else if strings.Contains(nameUpper, "AGRALE") {
				busTypes[code] = "AGRALE"
			}
		}
	}

	// 2. Listas de tareas por tipología
	runnerTasks := map[string]bool{
		"CAMBIAR FILTRO SECADOR DORADO RUNNER/AGRALE":                    true,
		"CAMBIAR BUJIA DENSO GK31A MOTOR RUNNER":                         true,
		"CAMBIAR CABLES ALTA BUJIA MOTOR RUNNER":                         true,
		"CAMBIAR FILTRO COMBUSTIBLE BAJA PRESION GAS MOTOR RUNNER":       true,
		"CAMBIAR ACEITE MOTOR GNV 15W-40":                                true,
		"CAMBIAR FILTRO ACEITE MOTOR RUNNER":                             true,
		"CAMBIAR FILTRO AIRE MOTOR RUNNER":                               true,
		"CAMBIAR FILTRO ALTA PRESION GAS MOTOR RUNNER":                   true,
		"LIMPIAR GUARDAPOLVO TAPA CAJA FILTRO AIRE RUNNER":               true,
		"CAMBIAR ACEITE DIRECCION HIDRAULICA MOBIL ATF D/M":              true,
		"CAMBIAR FILTRO ACEITE DIRECCION HIDRAULICA RUNNER":              true,
		"CAMBIAR ACEITE TRANSMISION MINERAL MOBILTRANS HD SERIES RUNNER": true,
		"CAMBIAR ACEITE DIFERENCIAL MOBILUBE HD 85W140":                  true,
	}

	nprTasks := map[string]bool{
		"CAMBIAR ACEITE DIRECCION HIDRAULICA MOBIL ATF D/M":                              true,
		"CAMBIAR ACEITE DIFERENCIAL MOBILUBE HD 85W140":                                  true,
		"CAMBIAR FILTRO DOBLE COMBUSTIBLE NPR-AGRALE (PRIMARIO ACPM INSTALADO EN MOTOR)": true,
		"LIMPIAR SISTEMA ADMISION MOTOR ISUZU NPR":                                       true,
		"CAMBIAR FILTRO SEPARADOR COMBUSTIBLE NPR (SALIDA TANQUE ACPM)":                  true,
		"CAMBIAR FILTRO AIRE NPR":                                                        true,
		"CAMBIAR FILTRO ACEITE MOTOR NPR":                                                true,
		"CAMBIAR ACEITE 15W-40 CI-4":                                                     true,
	}

	agraleTasks := map[string]bool{
		"CAMBIAR TERMOSTATO AGRALE":                              true,
		"CAMBIAR FILTRO AIRE INTERNO MOTOR AGRALE":               true,
		"CAMBIAR FILTRO SECADOR DORADO RUNNER/AGRALE":            true,
		"CAMBIAR ACEITE 15W-40 CI-4":                             true,
		"CAMBIAR FILTRO ACEITE MOTOR AGRALE":                     true,
		"CAMBIAR FILTRO AIRE EXTERNO MOTOR AGRALE":               true,
		"CAMBIAR FILTRO COMBUSTIBLE MOTOR AGRALE":                true,
		"CAMBIAR FILTRO POST TRATAMIENTO GASES ESCAPE AGRALE":    true,
		"CAMBIAR FILTRO SEPARADOR COMBUSTIBLE FLEETGUARD AGRALE": true,
		"LIMPIAR CARCASA FILTRO ACEITE MOTOR AGRALE":             true,
		"LIMPIAR RESPIRADERO ACEITE MOTOR AGRALE":                true,
		"CAMBIAR ACEITE DIRECCION HIDRAULICA MOBIL ATF D/M":      true,
		"CAMBIAR LIQUIDO (FRENOS/EMBRAGUE) DOT-4":                true,
		"CAMBIAR FILTRO ACEITE HIDRAULICO DIRECCION AGRALE":      true,
		"CAMBIAR ACEITE TRANSMISION MOBILUBE GX80W90 AGRALE":     true,
		"CAMBIAR ACEITE DIFERENCIAL MOBILUBE HD 85W140":          true,
	}

	// 3. Obtener todas las tareas candidatas (proxima/vencida) de Programación
	query := `
		SELECT 
			codigo_activo as bus, 
			tarea, 
			estado_tarea as estado, 
			tarea_abierta_posterior, 
			frecuencia_tarea_ultima, 
			duracion_hoy_ied,
			bus_en_franja_hoy
		FROM reporte_tareas 
		WHERE LOWER(estado_tarea) IN ('proxima', 'vencida')
		AND estado_bus IS NULL
		AND bus_en_franja_hoy IN ('SI', 'NO')
		AND (
			dias_en_franja_actual <= 1
			OR dias_en_franja_actual IS NULL
		)
	`
	rows, err := r.db.Query(query)
	if err != nil {
		log.Printf("[ERROR] GetLubricacionReports (programacionDB): %v", err)
		return nil, fmt.Errorf("error al consultar reporte_tareas: %w", err)
	}
	defer rows.Close()

	var reportes []ReporteTarea
	for rows.Next() {
		var rt ReporteTarea
		var tareaAbierta, frecuenciaUltima, busEnFranja sql.NullString
		var duracionHoy sql.NullFloat64
		if err := rows.Scan(&rt.Bus, &rt.Tarea, &rt.Estado, &tareaAbierta, &frecuenciaUltima, &duracionHoy, &busEnFranja); err != nil {
			continue
		}
		if tareaAbierta.Valid {
			rt.TareaAbiertaPosterior = tareaAbierta.String
		}
		if frecuenciaUltima.Valid {
			rt.FrecuenciaTareaUltima = frecuenciaUltima.String
		}
		if duracionHoy.Valid {
			rt.DatoHoy = fmt.Sprintf("%.0f", duracionHoy.Float64)
		}

		tipo := busTypes[rt.Bus]
		if (tipo == "RUNNER" && runnerTasks[rt.Tarea]) ||
			(tipo == "NPR" && nprTasks[rt.Tarea]) ||
			(tipo == "AGRALE" && agraleTasks[rt.Tarea]) {
			reportes = append(reportes, rt)
		}
	}

	return r.filterOpenTasks(reportes), nil
}

func (r *mysqlRepository) GetDiagnosticoReports() ([]ReporteTarea, error) {
	diagnosticoTasks := map[string]bool{
		"ALISTAMIENTO PROFUNDO BUS AGRALE 8.7 CON CARROCERÍA SENIOR":  true,
		"ALISTAMIENTO PROFUNDO BUS BYD ELECTRICO BC75S01":             true,
		"ALISTAMIENTO PROFUNDO BUS DINA RUNNER 8G":                    true,
		"ALISTAMIENTO PROFUNDO BUS NPR REWARD CON CARROCERIA BUSSCAR": true,
	}

	query := `
		SELECT 
			codigo_activo as bus, 
			tarea, 
			estado_tarea as estado, 
			tarea_abierta_posterior, 
			frecuencia_tarea_ultima, 
			duracion_hoy_ied,
			bus_en_franja_hoy
		FROM reporte_tareas 
		WHERE LOWER(estado_tarea) IN ('proxima', 'vencida')
		AND estado_bus IS NULL
		AND bus_en_franja_hoy IN ('SI', 'NO')
		AND (
			dias_en_franja_actual <= 1
			OR dias_en_franja_actual IS NULL
		)
	`
	rows, err := r.db.Query(query)
	if err != nil {
		log.Printf("[ERROR] GetDiagnosticoReports: %v", err)
		return nil, fmt.Errorf("error al consultar reporte_tareas: %w", err)
	}
	defer rows.Close()

	var reportes []ReporteTarea
	for rows.Next() {
		var rt ReporteTarea
		var tareaAbierta, frecuenciaUltima, busEnFranja sql.NullString
		var duracionHoy sql.NullFloat64
		if err := rows.Scan(&rt.Bus, &rt.Tarea, &rt.Estado, &tareaAbierta, &frecuenciaUltima, &duracionHoy, &busEnFranja); err != nil {
			continue
		}
		if tareaAbierta.Valid {
			rt.TareaAbiertaPosterior = tareaAbierta.String
		}
		if frecuenciaUltima.Valid {
			rt.FrecuenciaTareaUltima = frecuenciaUltima.String
		}
		if duracionHoy.Valid {
			rt.DatoHoy = fmt.Sprintf("%.0f", duracionHoy.Float64)
		}

		if diagnosticoTasks[rt.Tarea] {
			reportes = append(reportes, rt)
		}
	}

	return r.filterOpenTasks(reportes), nil
}
func (r *mysqlRepository) GetDetalleTareaAdmon(ids []string) ([]TareaAdmon, error) {
	if len(ids) == 0 {
		return []TareaAdmon{}, nil
	}

	// Optimización para Vistas de ADMON: Inyectar valores literales para evitar escaneo completo
	inValues := make([]string, 0, len(ids))
	for _, id := range ids {
		// Validar que sea numérico para seguridad
		if _, err := strconv.ParseInt(id, 10, 64); err == nil {
			inValues = append(inValues, "'"+id+"'")
		}
	}

	if len(inValues) == 0 {
		return []TareaAdmon{}, nil
	}

	query := fmt.Sprintf(`
		SELECT 
			id_tarea_generada,
			codigo_activo,
			clase_activo,
			referencia_inteligente,
			parte,
			nombre_dia_generacion_programa_mtto
		FROM tareas_solicitadas_activos 
		WHERE estado_tarea = "ABIERTA" 
		AND politica = "POLITICA PREVENTIVO-FRECUENCIA FIJA" 
		AND id_tarea_generada IN (%s)
	`, strings.Join(inValues, ","))

	start := time.Now()
	rows, err := r.admonDB.Query(query)
	if err != nil {
		log.Printf("[ERROR] GetDetalleTareaAdmon Query: %v", err)
		return nil, fmt.Errorf("error al consultar tareas_solicitadas_activos: %w", err)
	}
	log.Printf("[DEBUG] GetDetalleTareaAdmon ejecutado en %v para %d IDs", time.Since(start), len(inValues))
	defer rows.Close()

	var tareas []TareaAdmon
	for rows.Next() {
		var t TareaAdmon
		if err := rows.Scan(
			&t.IDTareaGenerada,
			&t.CodigoActivo,
			&t.ClaseActivo,
			&t.ReferenciaInteligente,
			&t.Parte,
			&t.NombreDia,
		); err != nil {
			continue
		}
		tareas = append(tareas, t)
	}

	return tareas, nil
}

func (r *mysqlRepository) GetPartesParaExcel(tareasAbiertas []string) (map[string]DatosExcelAdmon, error) {
	start := time.Now()
	log.Printf("[DEBUG] [INICIO] GetPartesParaExcel - Tareas a procesar: %d", len(tareasAbiertas))
	// Extraer IDs únicos del texto con formato: "... | ID: 123456 | ..."
	idSet := make(map[string]struct{})
	for _, texto := range tareasAbiertas {
		if m := reIDTarea.FindStringSubmatch(texto); len(m) == 2 {
			idSet[m[1]] = struct{}{}
		} else {
			log.Printf("[DEBUG] No se pudo extraer ID de: %s", texto)
		}
	}

	if len(idSet) == 0 {
		log.Println("[DEBUG] No se extrajeron IDs válidos de las tareas abiertas")
		return map[string]DatosExcelAdmon{}, nil
	}

	log.Printf("[DEBUG] IDs extraídos para consulta: %v", idSet)

	// NOTA CRÍTICA: El log de EXPLAIN arrojó "lacking privileges for underlying table".
	// Esto confirma 100% que tareas_solicitadas_activos es una VISTA (VIEW), no una tabla real.
	// En MySQL, usar Prepared Statements (con '?') sobre Vistas a veces hace que el optimizador
	// colapse y materialice toda la vista (leyendo millones de filas) en vez de filtrar rápido.
	// Solución: Inyectar los valores literalmente en la consulta como lo haría un cliente SQL.

	inValues := make([]string, 0, len(idSet))
	for idStr := range idSet {
		// Validamos que sea numérico para evitar 100% el SQL Injection
		if _, err := strconv.ParseInt(idStr, 10, 64); err == nil {
			inValues = append(inValues, "'"+idStr+"'")
		}
	}

	if len(inValues) == 0 {
		return nil, fmt.Errorf("no se encontraron IDs válidos para procesar")
	}

	// --- Pre-cargar tablas de lookup en memoria (evitar JOINs en la query principal) ---
	causaBasicaMap := r.cargarMapaCausaBasica()
	agrupadorTareasMap := r.cargarMapaAgrupadorTareas()
	empleadosMap := r.cargarMapaEmpleados()
	zonaMaquinaMap := r.cargarMapaZonaMaquina()
	log.Printf("[DEBUG] Lookup maps cargados: %d causa_basica, %d agrupador_tareas, %d empleados, %d zona_maquina",
		len(causaBasicaMap), len(agrupadorTareasMap), len(empleadosMap), len(zonaMaquinaMap))

	// Query limpia: sin JOINs, solo el WHERE con los IDs
	query := fmt.Sprintf(`
		SELECT 
			id_tarea_generada, 
			parte,
			DATE_FORMAT(fecha_generacion_programa_mtto, '%%Y-%%m-%%d') as fecha_propuesta,
			nombre_dia_generacion_programa_mtto,
			modo_deteccion,
			prioridad,
			subproceso,
			zona_maquina,
			causa_basica,
			tiempo_caracterizacion_formato_hora,
			tiempo_desplazamiento_horas,
			tiempo_planeacion_en_horas,
			tiempo_cierre_en_horas,
			observacion_tarea,
			frecuencia_tarea,
			frecuencia_caracterizada,
			tipo_politica,
			politica,
			numero_novedad,
			descripcion_novedad,
			motivo_devolucion_a_nube,
			duracion_segun_variable_de_tarea,
			porcentaje_duracion,
			posible_responsable_danio,
			id_tarea_solicitada,
			fecha_solicitud_novedad,
			taxonomia_encadenada,
			DATE_FORMAT(fecha_generacion_programa_mtto, '%%m') as mes_inicio,
			dia_inicio,
			variable_generacion_programa_mtto,
			codigo_activo,
			responsable,
			identificacion_empleado,
			empleado,
			agrupacion_tarea,
			referencia_inteligente
		FROM tareas_solicitadas_activos
		WHERE id_tarea_generada IN (%s)
	`, strings.Join(inValues, ","))

	queryStart := time.Now()
	// Importante: No pasamos args... porque inyectamos los valores directos para optimizar la Vista
	rows, err := r.admonDB.Query(query)
	if err != nil {
		log.Printf("[ERROR] GetPartesParaExcel Query Admon: %v", err)
		return nil, fmt.Errorf("error al consultar partes en admonDB: %w", err)
	}
	defer rows.Close()
	log.Printf("[DEBUG] Query Admon completada en %v", time.Since(queryStart))

	count := 0
	resultado := make(map[string]DatosExcelAdmon)
	for rows.Next() {
		var idTarea string
		var parte, fechaPropuesta, nombreDia, modoDeteccion, prioridad, subproceso, zonaMaquina, causaBasicaRaw, tiempoCaracterizacion, tiempoDesplazamiento, tiempoPlaneacion, tiempoCierre, observacion, frecuencia, frecuenciaCaracterizada, tipoPolitica, politica, numeroNovedad, novedad, motivoCausaParada, duracion, porcentajeDuracion, usuarioCreador, idTareaSolicitada, fechaSolicitudNovedad, taxonomiaEncadenada, mesInicio, diaInicio, variableGeneracion, bus, responsable, identificacionEmpleado, empleado, agrupacionTareaRaw, referenciaInteligente sql.NullString

		if err := rows.Scan(
			&idTarea, &parte, &fechaPropuesta, &nombreDia, &modoDeteccion, &prioridad,
			&subproceso, &zonaMaquina, &causaBasicaRaw, &tiempoCaracterizacion,
			&tiempoDesplazamiento, &tiempoPlaneacion, &tiempoCierre, &observacion,
			&frecuencia, &frecuenciaCaracterizada, &tipoPolitica, &politica,
			&numeroNovedad, &novedad, &motivoCausaParada,
			&duracion, &porcentajeDuracion, &usuarioCreador,
			&idTareaSolicitada, &fechaSolicitudNovedad, &taxonomiaEncadenada,
			&mesInicio, &diaInicio, &variableGeneracion, &bus,
			&responsable, &identificacionEmpleado, &empleado, &agrupacionTareaRaw, &referenciaInteligente,
		); err != nil {
			log.Printf("[ERROR] Scan fila %s: %v", idTarea, err)
			continue
		}

		datos := DatosExcelAdmon{}
		if parte.Valid {
			datos.Parte = parte.String
		}
		if fechaPropuesta.Valid {
			datos.FechaPropuesta = fechaPropuesta.String
		}
		if nombreDia.Valid {
			datos.NombreDia = nombreDia.String
		}
		if modoDeteccion.Valid {
			datos.ModoDeteccion = modoDeteccion.String
		}
		if prioridad.Valid {
			p := strings.TrimSpace(prioridad.String)
			if len(p) > 0 {
				datos.Prioridad = string(p[0]) // Solo el primer carácter (ej: "4")
			}
		}
		if subproceso.Valid {
			s := strings.ToUpper(strings.TrimSpace(subproceso.String))
			finalSub := s
			if strings.Contains(s, "PREVENTIVO") || strings.Contains(s, "PRENVENTIVO") {
				finalSub = "PREVEN"
			}
			if len(finalSub) > 6 {
				datos.Subproceso = finalSub[:6]
			} else {
				datos.Subproceso = finalSub
			}
		}
		if zonaMaquina.Valid {
			nombreZona := strings.ToUpper(strings.TrimSpace(zonaMaquina.String))
			if codigo, ok := zonaMaquinaMap[nombreZona]; ok {
				datos.ZonaMaquina = codigo
			} else {
				datos.ZonaMaquina = zonaMaquina.String
			}
		}
		if tiempoCaracterizacion.Valid {
			datos.TiempoCaracterizacion = tiempoCaracterizacion.String
		}
		if tiempoDesplazamiento.Valid {
			datos.TiempoDesplazamiento = tiempoDesplazamiento.String
		}
		if tiempoPlaneacion.Valid {
			datos.TiempoPlaneacion = tiempoPlaneacion.String
		}
		if tiempoCierre.Valid {
			datos.TiempoCierre = tiempoCierre.String
		}
		if observacion.Valid {
			datos.Observacion = observacion.String
		}
		if frecuencia.Valid {
			datos.Frecuencia = frecuencia.String
		}
		if frecuenciaCaracterizada.Valid {
			datos.FrecuenciaCaracterizada = frecuenciaCaracterizada.String
		}
		if tipoPolitica.Valid {
			datos.TipoPolitica = tipoPolitica.String
		}
		if politica.Valid {
			datos.Politica = politica.String
		}
		if numeroNovedad.Valid {
			datos.NumeroNovedad = numeroNovedad.String
		}
		if novedad.Valid {
			datos.Novedad = novedad.String
		}
		if motivoCausaParada.Valid {
			datos.MotivoCausaParada = motivoCausaParada.String
		}
		if duracion.Valid {
			datos.Duracion = duracion.String
		}
		if porcentajeDuracion.Valid {
			datos.PorcentajeDuracion = porcentajeDuracion.String
		}
		if usuarioCreador.Valid {
			datos.UsuarioCreador = usuarioCreador.String
		}
		if idTareaSolicitada.Valid {
			datos.IDTareaSolicitada = idTareaSolicitada.String
		}
		if fechaSolicitudNovedad.Valid {
			datos.FechaSolicitudNovedad = fechaSolicitudNovedad.String
		}
		if taxonomiaEncadenada.Valid {
			datos.TaxonomiaEncadenada = taxonomiaEncadenada.String
		}
		if mesInicio.Valid {
			datos.MesInicio = mesInicio.String
		}
		if diaInicio.Valid {
			datos.DiaInicio = diaInicio.String
		}
		if variableGeneracion.Valid {
			datos.VariableGeneracion = variableGeneracion.String
		}
		if bus.Valid {
			datos.Bus = bus.String
		}
		if responsable.Valid {
			nombreResp := strings.ToUpper(strings.TrimSpace(responsable.String))
			if codigo, ok := empleadosMap[nombreResp]; ok {
				datos.CodigoResponsable = codigo
			} else {
				datos.CodigoResponsable = responsable.String
			}
		}
		if identificacionEmpleado.Valid {
			datos.IdentificacionEmpleado = identificacionEmpleado.String
		}
		if empleado.Valid {
			datos.Empleado = empleado.String
		}
		if referenciaInteligente.Valid {
			datos.ReferenciaInteligente = referenciaInteligente.String
		}

		// Resolver causa_basica usando el mapa precargado
		if causaBasicaRaw.Valid {
			nombre := strings.TrimSpace(causaBasicaRaw.String)
			if codigo, ok := causaBasicaMap[strings.ToUpper(nombre)]; ok {
				datos.CausaBasica = codigo
			} else {
				datos.CausaBasica = nombre
			}
		}

		// Resolver agrupacion_tarea usando el mapa precargado
		if agrupacionTareaRaw.Valid && agrupacionTareaRaw.String != "" {
			if nombre, ok := agrupadorTareasMap[agrupacionTareaRaw.String]; ok {
				datos.AgrupacionTarea = nombre
			}
		}

		resultado[idTarea] = datos
		count++
	}

	// --- BATCH: obtener todos los valores de variables en UNA sola consulta ---
	pendientes := make(map[claveVariable]struct{})
	for idTarea, datos := range resultado {
		if datos.Bus == "" || datos.VariableGeneracion == "" {
			continue
		}
		vGen := strings.ToUpper(strings.TrimSpace(datos.VariableGeneracion))
		tipoVar := ""
		if strings.Contains(vGen, "KILOMETRO") {
			tipoVar = "KILOMETROS"
		} else if strings.Contains(vGen, "HORA") {
			tipoVar = "HORA_MOTOR"
		}
		if tipoVar != "" {
			pendientes[claveVariable{datos.Bus, tipoVar}] = struct{}{}
		}
		_ = idTarea
	}

	log.Printf("[DEBUG] Procesamiento de filas Admon completado (%d filas). Iniciando consulta de variables...", len(resultado))

	if len(pendientes) == 0 {
		log.Printf("[DEBUG] [FIN] GetPartesParaExcel - No hay variables pendientes. Tiempo total: %v", time.Since(start))
		return resultado, nil
	}

	varStart := time.Now()
	valoresMap := r.getBatchValoresVariables(pendientes)
	log.Printf("[DEBUG] Consulta de variables completada en %v", time.Since(varStart))

	minVarStart := time.Now()
	valoresMinMap := r.getBatchValoresMinVariables(pendientes)
	log.Printf("[DEBUG] Consulta de valores MIN variables completada en %v", time.Since(minVarStart))

	// Asignar los valores al resultado
	for idTarea, datos := range resultado {
		if datos.Bus == "" || datos.VariableGeneracion == "" {
			continue
		}
		vGen := strings.ToUpper(strings.TrimSpace(datos.VariableGeneracion))
		tipoVar := ""
		if strings.Contains(vGen, "KILOMETRO") {
			tipoVar = "KILOMETROS"
		} else if strings.Contains(vGen, "HORA") {
			tipoVar = "HORA_MOTOR"
		}
		if tipoVar != "" {
			if valor, ok := valoresMap[claveVariable{datos.Bus, tipoVar}]; ok {
				datos.ValorVariable = fmt.Sprintf("%.0f", valor)
			}
			if valorMin, ok := valoresMinMap[claveVariable{datos.Bus, tipoVar}]; ok {
				datos.ValorMinVariable = valorMin
			}
			resultado[idTarea] = datos
		}
	}

	// --- NUEVA LÓGICA: DÍAS OPERADOS ---
	busesDiasOperados := make(map[string]struct{})
	for _, datos := range resultado {
		if strings.Contains(strings.ToUpper(datos.Frecuencia), "DIAS OPERADOS") {
			if datos.Bus != "" {
				busesDiasOperados[datos.Bus] = struct{}{}
			}
		}
	}

	if len(busesDiasOperados) > 0 {
		log.Printf("[DEBUG] Calculando DÍAS OPERADOS para %d buses", len(busesDiasOperados))
		resultadosDias := r.getBatchValoresDiasOperados(busesDiasOperados)
		for idTarea, datos := range resultado {
			if strings.Contains(strings.ToUpper(datos.Frecuencia), "DIAS OPERADOS") {
				if res, ok := resultadosDias[datos.Bus]; ok {
					datos.ValorVariable = fmt.Sprintf("%.0f", res.Valor)
					datos.ValorMinVariable = fmt.Sprintf("%.0f", res.Base)
					resultado[idTarea] = datos
				}
			}
		}
	}

	log.Printf("[DEBUG] [FIN] GetPartesParaExcel - Proceso completo en %v. Filas finales: %d", time.Since(start), count)
	return resultado, nil
}

// cargarMapaCausaBasica carga toda la tabla causa_basica en un mapa nombre(UPPER) -> codigo.
// Esta tabla es pequeña (decenas de filas) y evita un JOIN costoso en la query principal.
func (r *mysqlRepository) cargarMapaCausaBasica() map[string]string {
	resultado := make(map[string]string)
	rows, err := r.admonDB.Query(`SELECT codigo, nombre FROM causa_basica`)
	if err != nil {
		log.Printf("[WARN] cargarMapaCausaBasica: %v", err)
		return resultado
	}
	defer rows.Close()
	for rows.Next() {
		var codigo, nombre string
		if err := rows.Scan(&codigo, &nombre); err != nil {
			continue
		}
		resultado[strings.ToUpper(strings.TrimSpace(nombre))] = codigo
	}
	return resultado
}

// cargarMapaAgrupadorTareas carga toda la tabla agrupador_tareas en un mapa id -> nombre.
// Esta tabla es pequeña y evita un JOIN costoso en la query principal.
func (r *mysqlRepository) cargarMapaAgrupadorTareas() map[string]string {
	resultado := make(map[string]string)
	rows, err := r.admonDB.Query(`SELECT id_agrupador_tareas, nombre FROM agrupador_tareas`)
	if err != nil {
		log.Printf("[WARN] cargarMapaAgrupadorTareas: %v", err)
		return resultado
	}
	defer rows.Close()
	for rows.Next() {
		var id, nombre string
		if err := rows.Scan(&id, &nombre); err != nil {
			continue
		}
		resultado[id] = nombre
	}
	return resultado
}

// getBatchValoresVariables obtiene en UNA sola consulta los valores de variable
// para todas las combinaciones (bus, tipoVar) solicitadas.
// Busca el último registro con valor NO NULO y proyecta días para HORA_MOTOR.
func (r *mysqlRepository) getBatchValoresVariables(pendientes map[claveVariable]struct{}) map[claveVariable]float64 {
	resultado := make(map[claveVariable]float64)
	if len(pendientes) == 0 {
		return resultado
	}

	// Obtener lista única de buses para filtrar la consulta
	busesSet := make(map[string]struct{})
	for k := range pendientes {
		busesSet[k.bus] = struct{}{}
	}

	if len(busesSet) == 0 {
		return resultado
	}

	busList := make([]string, 0, len(busesSet))
	for b := range busesSet {
		busList = append(busList, b)
	}

	// Construir placeholders para los buses
	placeholders := make([]string, len(busList))
	args := make([]interface{}, len(busList))
	for i, b := range busList {
		placeholders[i] = "?"
		args[i] = b
	}

	// La subconsulta filtra registros con valor no nulo y por los buses específicos,
	// lo que reduce drásticamente el tiempo de ejecución si hay muchos datos.
	query := fmt.Sprintf(`
		SELECT codigo_vehiculo, tipo_variable,
			SUBSTRING_INDEX(GROUP_CONCAT(valor_variable_delta ORDER BY fecha_registro_real DESC), ',', 1) AS valor,
			MAX(fecha_registro_real) AS max_fecha
		FROM registro_variables
		WHERE valor_variable_delta IS NOT NULL
		AND codigo_vehiculo IN (%s)
		GROUP BY codigo_vehiculo, tipo_variable
	`, strings.Join(placeholders, ","))

	rows, err := r.variablesDB.Query(query, args...)
	if err != nil {
		log.Printf("[ERROR] getBatchValoresVariables: %v", err)
		return resultado
	}
	defer rows.Close()

	hoy := time.Now().Truncate(24 * time.Hour) // Medianoche de hoy para comparar días exactos

	for rows.Next() {
		var bus, tipoVar string
		var valorStr sql.NullString
		var maxFecha sql.NullTime
		if err := rows.Scan(&bus, &tipoVar, &valorStr, &maxFecha); err != nil {
			log.Printf("[ERROR] Scan getBatch: %v", err)
			continue
		}
		if !valorStr.Valid || !maxFecha.Valid {
			continue
		}
		if _, ok := pendientes[claveVariable{bus, tipoVar}]; !ok {
			continue
		}
		valor, err := strconv.ParseFloat(strings.TrimSpace(valorStr.String), 64)
		if err != nil {
			continue
		}
		if tipoVar == "HORA_MOTOR" {
			fechaLectura := maxFecha.Time.Truncate(24 * time.Hour)
			dias := math.Floor(hoy.Sub(fechaLectura).Hours() / 24)
			if dias > 0 {
				valor += dias * 16
				log.Printf("[DEBUG] %s HORA_MOTOR: valor base=%.0f + %.0f días x 16h = %.0f", bus, valor-dias*16, dias, valor)
			}
		}
		resultado[claveVariable{bus, tipoVar}] = valor
	}

	log.Printf("[DEBUG] getBatch: variables resueltas para %d combinaciones de %d pendientes", len(resultado), len(pendientes))
	return resultado
}

func (r *mysqlRepository) getBatchValoresMinVariables(pendientes map[claveVariable]struct{}) map[claveVariable]string {
	resultado := make(map[claveVariable]string)
	if len(pendientes) == 0 {
		return resultado
	}

	busesSet := make(map[string]struct{})
	for k := range pendientes {
		busesSet[k.bus] = struct{}{}
	}

	if len(busesSet) == 0 {
		return resultado
	}

	busList := make([]string, 0, len(busesSet))
	for b := range busesSet {
		busList = append(busList, b)
	}

	placeholders := make([]string, len(busList))
	args := make([]interface{}, len(busList))
	for i, b := range busList {
		placeholders[i] = "?"
		args[i] = b
	}

	query := fmt.Sprintf(`
		SELECT codigo_activo, variable_control,
			SUBSTRING_INDEX(GROUP_CONCAT(valor_variable_control ORDER BY fecha_variable_control DESC), ',', 1) AS valor
		FROM actualizacion_variable_control
		WHERE codigo_activo IN (%s)
		GROUP BY codigo_activo, variable_control
	`, strings.Join(placeholders, ","))

	rows, err := r.admonDB.Query(query, args...)
	if err != nil {
		log.Printf("[ERROR] getBatchValoresMinVariables: %v", err)
		return resultado
	}
	defer rows.Close()

	for rows.Next() {
		var bus, variableControl string
		var valorStr sql.NullString
		if err := rows.Scan(&bus, &variableControl, &valorStr); err != nil {
			log.Printf("[ERROR] Scan getBatchMin: %v", err)
			continue
		}
		if !valorStr.Valid {
			continue
		}
		vCtrl := strings.ToUpper(strings.TrimSpace(variableControl))
		tipoVar := ""
		if strings.Contains(vCtrl, "KILOMETRO") {
			tipoVar = "KILOMETROS"
		} else if strings.Contains(vCtrl, "HORA") {
			tipoVar = "HORA_MOTOR"
		}
		if tipoVar == "" {
			continue
		}
		if _, ok := pendientes[claveVariable{bus, tipoVar}]; ok {
			if v, err := strconv.ParseFloat(strings.TrimSpace(valorStr.String), 64); err == nil {
				resultado[claveVariable{bus, tipoVar}] = fmt.Sprintf("%.0f", v)
			}
		}
	}

	return resultado
}

func (r *mysqlRepository) getBatchValoresDiasOperados(buses map[string]struct{}) map[string]struct{ Valor, Base float64 } {
	resultado := make(map[string]struct{ Valor, Base float64 })
	if len(buses) == 0 {
		return resultado
	}

	busList := make([]string, 0, len(buses))
	for b := range buses {
		busList = append(busList, b)
	}

	placeholders := make([]string, len(busList))
	args := make([]interface{}, len(busList))
	for i, b := range busList {
		placeholders[i] = "?"
		args[i] = b
	}

	// Consultamos la tabla de actualización de variables para DÍAS OPERADOS
	query := fmt.Sprintf(`
		SELECT codigo_activo, 
			SUBSTRING_INDEX(GROUP_CONCAT(valor_variable_control ORDER BY fecha_variable_control DESC), ',', 1) AS valor,
			MAX(fecha_variable_control) AS max_fecha
		FROM actualizacion_variable_control
		WHERE variable_control = 'DÍAS OPERADOS'
		AND codigo_activo IN (%s)
		GROUP BY codigo_activo
	`, strings.Join(placeholders, ","))

	rows, err := r.admonDB.Query(query, args...)
	if err != nil {
		log.Printf("[ERROR] getBatchValoresDiasOperados: %v", err)
		return resultado
	}
	defer rows.Close()

	hoy := time.Now().Truncate(24 * time.Hour)

	for rows.Next() {
		var bus string
		var valorStr sql.NullString
		var maxFecha sql.NullTime
		if err := rows.Scan(&bus, &valorStr, &maxFecha); err != nil {
			continue
		}
		if !valorStr.Valid || !maxFecha.Valid {
			continue
		}

		valor, err := strconv.ParseFloat(strings.TrimSpace(valorStr.String), 64)
		if err != nil {
			continue
		}

		// Cálculo de diferencia de días entre la última lectura y hoy
		fechaLectura := maxFecha.Time.Truncate(24 * time.Hour)
		diasDiff := math.Floor(hoy.Sub(fechaLectura).Hours() / 24)

		base := valor
		if diasDiff > 0 {
			valor += diasDiff
			log.Printf("[DEBUG] %s DÍAS OPERADOS: valor base=%.0f + %.0f días = %.0f", bus, base, diasDiff, valor)
		}

		resultado[bus] = struct{ Valor, Base float64 }{Valor: valor, Base: base}
	}

	return resultado
}

// cargarMapaEmpleados carga la tabla informacion_empleados y genera un mapa Nombre Completo -> Codigo
func (r *mysqlRepository) cargarMapaEmpleados() map[string]string {
	resultado := make(map[string]string)
	rows, err := r.admonDB.Query(`SELECT codigo, nombre, apellido FROM informacion_empleados`)
	if err != nil {
		log.Printf("[WARN] cargarMapaEmpleados: %v", err)
		return resultado
	}
	defer rows.Close()

	for rows.Next() {
		var codigo, nombre, apellido string
		if err := rows.Scan(&codigo, &nombre, &apellido); err != nil {
			continue
		}
		// Generar nombre completo para match
		fullName := strings.ToUpper(strings.TrimSpace(nombre + " " + apellido))
		resultado[fullName] = strings.TrimSpace(codigo)
	}
	return resultado
}

// cargarMapaZonaMaquina carga la tabla zona_maquina y genera un mapa Nombre -> Codigo
func (r *mysqlRepository) cargarMapaZonaMaquina() map[string]string {
	resultado := make(map[string]string)
	rows, err := r.admonDB.Query(`SELECT codigo, nombre FROM zona_maquina`)
	if err != nil {
		log.Printf("[WARN] cargarMapaZonaMaquina: %v", err)
		return resultado
	}
	defer rows.Close()

	for rows.Next() {
		var codigo, nombre string
		if err := rows.Scan(&codigo, &nombre); err != nil {
			continue
		}
		resultado[strings.ToUpper(strings.TrimSpace(nombre))] = strings.TrimSpace(codigo)
	}
	return resultado
}

func (r *mysqlRepository) GetResponsables() ([]Empleado, error) {
	query := `
		SELECT codigo, nombre, apellido, cargo 
		FROM informacion_empleados 
		WHERE cargo IN ('LIDER DE MANTENIMIENTO-UNOE', 'LIDER DE SERVICIO-UNOE')
		AND fecha_retiro IS NULL
		ORDER BY nombre ASC
	`
	rows, err := r.admonDB.Query(query)
	if err != nil {
		log.Printf("[ERROR] GetResponsables: %v", err)
		return nil, fmt.Errorf("error al consultar responsables: %w", err)
	}
	defer rows.Close()

	var empleados []Empleado
	for rows.Next() {
		var e Empleado
		if err := rows.Scan(&e.Codigo, &e.Nombre, &e.Apellido, &e.Cargo); err != nil {
			continue
		}
		empleados = append(empleados, e)
	}
	return empleados, nil
}

func (r *mysqlRepository) GetTecnicos() ([]Empleado, error) {
	query := `
		SELECT codigo, nombre, apellido, cargo 
		FROM informacion_empleados 
		WHERE cargo IN ('TECNICO ELECTROMECANICO-UNOE', 'TECNICO DE DIAGNOSTICO ESPECIALIZADO-UNOE')
		AND fecha_retiro IS NULL
		ORDER BY nombre ASC
	`
	rows, err := r.admonDB.Query(query)
	if err != nil {
		log.Printf("[ERROR] GetTecnicos: %v", err)
		return nil, fmt.Errorf("error al consultar tecnicos: %w", err)
	}
	defer rows.Close()

	var empleados []Empleado
	for rows.Next() {
		var e Empleado
		if err := rows.Scan(&e.Codigo, &e.Nombre, &e.Apellido, &e.Cargo); err != nil {
			continue
		}
		empleados = append(empleados, e)
	}
	return empleados, nil
}
