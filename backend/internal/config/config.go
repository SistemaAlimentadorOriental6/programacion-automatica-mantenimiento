package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DBUser             string
	DBPassword         string
	DBServer           string
	DBDatabase         string
	DBEncrypt          string
	DBTrustCertificate string
	JWTSecret          string
	Port               string
	// MySQL Config
	MySQLHost     string
	MySQLPort     string
	MySQLUser     string
	MySQLPassword string
	MySQLDB       string
	// MySQL Admon Config
	MySQLAdmonHost     string
	MySQLAdmonPort     string
	MySQLAdmonUser     string
	MySQLAdmonPassword string
	MySQLAdmonDB       string
	// MySQL Variables Config
	MySQLVariablesDB   string
}

func LoadConfig() *Config {
	err := godotenv.Load()
	if err != nil {
		log.Println("Aviso: No se pudo cargar el archivo .env, se usarán variables de entorno del sistema")
	}

	return &Config{
		DBUser:             getEnv("DB_USER", "sa"),
		DBPassword:         getEnv("DB_PASSWORD", ""),
		DBServer:           getEnv("DB_SERVER", "localhost"),
		DBDatabase:         getEnv("DB_DATABASE", "master"),
		DBEncrypt:          getEnv("DB_ENCRYPT", "false"),
		DBTrustCertificate: getEnv("DB_TRUST_CERTIFICATE", "true"),
		JWTSecret:          getEnv("JWT_SECRET", "default-secret"),
		Port:               getEnv("PORT", "4000"),
		// MySQL Mapping
		MySQLHost:     getEnv("DB_HOST", "localhost"),
		MySQLPort:     getEnv("DB_PORT", "3306"),
		MySQLUser:     getEnv("DB_USUARIO", "root"),
		MySQLPassword: getEnv("DB_CONTRASENA", ""),
		MySQLDB:       getEnv("DB_NOMBRE", ""),
		// MySQL Admon Mapping
		MySQLAdmonHost:     getEnv("MYSQL_ADMON_HOST", "localhost"),
		MySQLAdmonPort:     getEnv("MYSQL_ADMON_PORT", "3306"),
		MySQLAdmonUser:     getEnv("MYSQL_ADMON_USER", "root"),
		MySQLAdmonPassword: getEnv("MYSQL_ADMON_PASSWORD", ""),
		MySQLAdmonDB:       getEnv("MYSQL_ADMON_DATABASE", ""),
		// MySQL Variables Mapping
		MySQLVariablesDB:   getEnv("DB_NOMBRE_VARIABLES", ""),
	}
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}
