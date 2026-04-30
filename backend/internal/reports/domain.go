package reports

type ReporteTarea struct {
	Bus                   string `json:"bus"`
	Tarea                 string `json:"tarea"`
	Estado                string `json:"estado"`
	TareaAbiertaPosterior string `json:"tarea_abierta_posterior"`
	FrecuenciaTareaUltima string `json:"frecuencia_tarea_ultima"`
	DatoHoy               string `json:"dato_hoy"`
}

type TareaAdmon struct {
	IDTareaGenerada      string `json:"id_tarea_generada"`
	CodigoActivo         string `json:"codigo_activo"`
	ClaseActivo          string `json:"clase_activo"`
	ReferenciaInteligente string `json:"referencia_inteligente"`
	Parte                string `json:"parte"`
	NombreDia            string `json:"nombre_dia"`
}

type DatosExcelAdmon struct {
	Parte          string `json:"parte"`
	FechaPropuesta string `json:"fecha_propuesta"`
	ModoDeteccion  string `json:"modo_deteccion"`
	Prioridad      string `json:"prioridad"`
	Subproceso     string `json:"subproceso"`
	ZonaMaquina    string `json:"zona_maquina"`
	CausaBasica    string `json:"causa_basica"`
	TiempoCaracterizacion string `json:"tiempo_caracterizacion"`
	TiempoDesplazamiento  string `json:"tiempo_desplazamiento"`
	TiempoPlaneacion      string `json:"tiempo_planeacion"`
	TiempoCierre          string `json:"tiempo_cierre"`
	Observacion           string `json:"observacion"`
	Frecuencia            string `json:"frecuencia"`
	FrecuenciaCaracterizada string `json:"frecuencia_caracterizada"`
	TipoPolitica          string `json:"tipo_politica"`
	Politica              string `json:"politica"`
	NumeroNovedad         string `json:"numero_novedad"`
	Novedad               string `json:"novedad"`
	MotivoCausaParada     string `json:"motivo_causa_parada"`
	Duracion              string `json:"duracion"`
	PorcentajeDuracion    string `json:"porcentaje_duracion"`
	UsuarioCreador        string `json:"usuario_creador"`
	IDTareaSolicitada     string `json:"id_tarea_solicitada"`
	FechaSolicitudNovedad string `json:"fecha_solicitud_novedad"`
	TaxonomiaEncadenada   string `json:"taxonomia_encadenada"`
	MesInicio             string `json:"mes_inicio"`
	DiaInicio             string `json:"dia_inicio"`
	CodigoResponsable     string `json:"codigo_responsable"`
	AgrupacionTarea       string `json:"agrupacion_tarea"`
	ValorVariable         string `json:"valor_variable"`
	VariableGeneracion    string `json:"variable_generacion"`
	Bus                   string `json:"bus"`
	ValorMinVariable      string `json:"valor_min_variable"`
	IdentificacionEmpleado string `json:"identificacion_empleado"`
	Empleado              string `json:"empleado"`
	ReferenciaInteligente string `json:"referencia_inteligente"`
	NombreDia             string `json:"nombre_dia"`
}

type Empleado struct {
	Codigo   string `json:"codigo"`
	Nombre   string `json:"nombre"`
	Apellido string `json:"apellido"`
	Cargo    string `json:"cargo"`
}
