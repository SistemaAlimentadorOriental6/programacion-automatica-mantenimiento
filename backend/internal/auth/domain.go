package auth

type User struct {
	Email     string      `json:"email"`
	Nit       string      `json:"nit"`
	Cargo     string      `json:"cargo"`
	Ndc       interface{} `json:"ndc"`
	Parametro interface{} `json:"parametro"`
}

type UserInfo struct {
	Nombre string `json:"nombre"`
	Cargo  string `json:"cargo"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Message string      `json:"message"`
	Done    bool        `json:"done"`
	Data    interface{} `json:"data"`
}
