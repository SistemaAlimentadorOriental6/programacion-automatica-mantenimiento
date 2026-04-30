package server

import (
	"database/sql"
	"log"
	"os"

	"backend/internal/auth"
	"backend/internal/config"
	"backend/internal/middleware"
	"backend/internal/reports"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
)

type Server struct {
	config  *config.Config
	app     *fiber.App
	db          *sql.DB
	mysqlDB     *sql.DB
	admonDB     *sql.DB
	variablesDB *sql.DB
}

func NewServer(cfg *config.Config, db *sql.DB, mysqlDB *sql.DB, admonDB *sql.DB, variablesDB *sql.DB) *Server {
	return &Server{
		config:      cfg,
		app:         fiber.New(),
		db:          db,
		mysqlDB:     mysqlDB,
		admonDB:     admonDB,
		variablesDB: variablesDB,
	}
}

func (s *Server) Run() error {
	// Configurar el logger de Fiber para escribir en el archivo de log
	logFile, _ := os.OpenFile("backend.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0666)
	s.app.Use(logger.New(logger.Config{
		Output: logFile,
		Format: "[${time}] ${status} - ${latency} ${method} ${path}\n",
	}))

	s.app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
	}))

	api := s.app.Group("/api")

	// Auth Module
	authRepo := auth.NewRepository(s.db)
	authService := auth.NewService(authRepo, s.config.JWTSecret)
	authHandler := auth.NewHandler(authService, s.config.JWTSecret)
	authHandler.MapRoutes(api)

	// Reports Module (MySQL)
	reportsRepo := reports.NewRepository(s.mysqlDB, s.admonDB, s.variablesDB)
	reportsHandler := reports.NewHandler(reportsRepo)
	api.Get("/reports", middleware.AuthMiddleware(s.config.JWTSecret), reportsHandler.GetReportes)
	api.Get("/reports/responsables", middleware.AuthMiddleware(s.config.JWTSecret), reportsHandler.GetResponsables)
	api.Get("/reports/tecnicos", middleware.AuthMiddleware(s.config.JWTSecret), reportsHandler.GetTecnicos)
	api.Get("/reports/lubricacion", middleware.AuthMiddleware(s.config.JWTSecret), reportsHandler.GetLubricacion)
	api.Get("/reports/diagnostico", middleware.AuthMiddleware(s.config.JWTSecret), reportsHandler.GetDiagnostico)
	api.Get("/reports/engrase", middleware.AuthMiddleware(s.config.JWTSecret), reportsHandler.GetEngrase)
	api.Post("/reports/detalle-admon", middleware.AuthMiddleware(s.config.JWTSecret), reportsHandler.GetDetalleAdmon)
	api.Post("/reports/partes-excel", middleware.AuthMiddleware(s.config.JWTSecret), reportsHandler.GetPartesExcel)

	log.Printf("Servidor iniciado en puerto %s", s.config.Port)
	return s.app.Listen(":" + s.config.Port)
}
