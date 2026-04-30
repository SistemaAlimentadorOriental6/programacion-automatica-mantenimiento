package auth

import (
	"context"
	"database/sql"
	"log"
	"strings"
	"backend/internal/platform/db/generated"
)

// Repository define el contrato para el acceso a datos de autenticación (SOLID: Interface Segregation)
type Repository interface {
	GetUserByCredentials(ctx context.Context, email, password string) (*User, error)
	GetUserInfo(ctx context.Context, email string) (*UserInfo, error)
}

type mssqlRepository struct {
	queries *generated.Queries
}

// NewRepository crea una nueva instancia del repositorio (SOLID: Dependency Inversion)
func NewRepository(conn *sql.DB) Repository {
	return &mssqlRepository{
		queries: generated.New(conn),
	}
}

func (r *mssqlRepository) GetUserByCredentials(ctx context.Context, email, password string) (*User, error) {
	log.Printf("[DEBUG] Consultando usuario - Email: [%s], Password: [%s]", email, password)
	res, err := r.queries.GetUserForLogin(ctx, email, password)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Println("[DEBUG] No se encontró ningún registro para esas credenciales y cargo")
		} else {
			log.Printf("[ERROR] Error en consulta SQL: %v", err)
		}
		return nil, err
	}
    log.Printf("[DEBUG] Usuario encontrado: %+v", res)

	return &User{
		Email:     strings.TrimSpace(res.FEmailContacto),
		Nit:       strings.TrimSpace(res.FNitEmpl),
		Cargo:     strings.TrimSpace(res.FDescCargo),
		Ndc:       res.FNdc,
		Parametro: trimIfString(res.FParametro),
	}, nil
}

func (r *mssqlRepository) GetUserInfo(ctx context.Context, email string) (*UserInfo, error) {
	log.Printf("[DEBUG] Obteniendo info de perfil para: [%s]", email)
	res, err := r.queries.GetUserInfo(ctx, email)
	if err != nil {
		log.Printf("[ERROR] Error obteniendo info de perfil para %s: %v", email, err)
		return nil, err
	}

	return &UserInfo{
		Nombre: getString(res.FNombreEmpl),
		Cargo:  strings.TrimSpace(res.FDescCargo),
	}, nil
}

func trimIfString(v interface{}) interface{} {
	if s, ok := v.(string); ok {
		return strings.TrimSpace(s)
	}
	return v
}

func getString(v interface{}) string {
	if s, ok := v.(string); ok {
		return s
	}
	if ns, ok := v.(sql.NullString); ok && ns.Valid {
		return ns.String
	}
	return ""
}
