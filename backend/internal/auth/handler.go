package auth

import (
	"backend/internal/middleware"
	"github.com/gofiber/fiber/v2"
)

type Handler struct {
	service Service
	secret  string
}

func NewHandler(service Service, secret string) *Handler {
	return &Handler{service: service, secret: secret}
}

func (h *Handler) MapRoutes(router fiber.Router) {
	group := router.Group("/auth")
	group.Post("/login", h.Login)
	group.Get("/get-data", middleware.AuthMiddleware(h.secret), h.GetData)
}

func (h *Handler) Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Formato de solicitud inválido"})
	}

	res, err := h.service.Login(c.Context(), req)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(res)
}

func (h *Handler) GetData(c *fiber.Ctx) error {
	email := c.Locals("user_email").(string)
	res, err := h.service.GetUserInfo(c.Context(), email)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(res)
}
