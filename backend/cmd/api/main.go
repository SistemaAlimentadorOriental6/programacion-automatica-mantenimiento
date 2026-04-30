package main

import (
	"database/sql"
	"fmt"
	"log"

	"backend/internal/config"
	"backend/internal/platform/server"

	_ "github.com/denisenkom/go-mssqldb"
	_ "github.com/go-sql-driver/mysql"
	"os"
)
func main() {
	// 1. Configurar logs a archivo
	logFile, err := os.OpenFile("backend.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0666)
	if err != nil {
		log.Fatal("No se pudo crear el archivo de log:", err)
	}
	log.SetOutput(logFile)
	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)

	log.Println("--- Iniciando servidor backend ---")

	// 2. Cargar configuración
	cfg := config.LoadConfig()

	// 2. Establecer conexión a SQL Server (Power BI / UNOEE)
	connString := fmt.Sprintf("server=%s;user id=%s;password=%s;database=%s;encrypt=%s;trustservercertificate=%s",
		cfg.DBServer,
		cfg.DBUser,
		cfg.DBPassword,
		cfg.DBDatabase,
		cfg.DBEncrypt,
		cfg.DBTrustCertificate,
	)

	dbConn, err := sql.Open("sqlserver", connString)
	if err != nil {
		log.Fatal("No se pudo abrir la conexión a SQL Server:", err)
	}
	defer dbConn.Close()

	if err := dbConn.Ping(); err != nil {
		log.Fatal("No se pudo conectar a SQL Server:", err)
	}

	// 3. Establecer conexión a MySQL (Reporte Tareas - Programación)
	dsnMySQL := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true",
		cfg.MySQLUser, cfg.MySQLPassword, cfg.MySQLHost, cfg.MySQLPort, cfg.MySQLDB)
	mysqlDB, err := sql.Open("mysql", dsnMySQL)
	if err != nil {
		log.Fatalf("Error conectando a MySQL Programación: %v", err)
	}
	defer mysqlDB.Close()

	dsnAdmon := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true",
		cfg.MySQLAdmonUser, cfg.MySQLAdmonPassword, cfg.MySQLAdmonHost, cfg.MySQLAdmonPort, cfg.MySQLAdmonDB)
	admonDB, err := sql.Open("mysql", dsnAdmon)
	if err != nil {
		log.Fatalf("Error conectando a MySQL Admon: %v", err)
	}
	defer admonDB.Close()

	// 5. Establecer conexión a MySQL (Control Operaciones - Variables)
	dsnVariables := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true",
		cfg.MySQLUser, cfg.MySQLPassword, cfg.MySQLHost, cfg.MySQLPort, cfg.MySQLVariablesDB)
	variablesDB, err := sql.Open("mysql", dsnVariables)
	if err != nil {
		log.Fatalf("Error conectando a MySQL Variables: %v", err)
	}
	defer variablesDB.Close()

	// 6. Iniciar Servidor
	srv := server.NewServer(cfg, dbConn, mysqlDB, admonDB, variablesDB)
	if err := srv.Run(); err != nil {
		log.Fatalf("Error ejecutando servidor: %v", err)
	}
}
