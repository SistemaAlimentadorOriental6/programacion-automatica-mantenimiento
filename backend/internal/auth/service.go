package auth

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Service define la lógica de negocio para la autenticación (SOLID: Single Responsibility)
type Service interface {
	Login(ctx context.Context, req LoginRequest) (*LoginResponse, error)
	GetUserInfo(ctx context.Context, email string) (*LoginResponse, error)
}

type authService struct {
	repo      Repository
	jwtSecret string
}

func NewService(repo Repository, jwtSecret string) Service {
	return &authService{
		repo:      repo,
		jwtSecret: jwtSecret,
	}
}

func (s *authService) Login(ctx context.Context, req LoginRequest) (*LoginResponse, error) {
	log.Printf("[INFO] Intento de login para: %s", req.Email)
	if req.Email == "" || req.Password == "" {
		return nil, errors.New("el correo y la contraseña son obligatorios")
	}

	user, err := s.repo.GetUserByCredentials(ctx, req.Email, req.Password)
	if err != nil {
		return nil, errors.New("credenciales inválidas o cargo no autorizado")
	}

	// Generar Token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"email": user.Email,
		"cargo": user.Cargo,
		"exp":   time.Now().Add(time.Hour * 24).Unix(),
	})

	tokenString, err := token.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return nil, errors.New("error al generar el token de acceso")
	}

	return &LoginResponse{
		Message: "Login correcto",
		Done:    true,
		Data: map[string]interface{}{
			"token": tokenString,
		},
	}, nil
}

func (s *authService) GetUserInfo(ctx context.Context, email string) (*LoginResponse, error) {
	userInfo, err := s.repo.GetUserInfo(ctx, email)
	if err != nil {
		return nil, errors.New("no se pudo obtener la información del usuario")
	}

	return &LoginResponse{
		Message: "Información obtenida",
		Done:    true,
		Data:    userInfo,
	}, nil
}
