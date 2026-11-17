package main

import (
	"encoding/json"
	"lab4/internal/controller"
	"lab4/internal/middleware"
	"lab4/internal/repository"
	"lab4/internal/service"
	"net/http"
	"time"
)

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":    "OK",
			"service":   "go-service-layered",
			"timestamp": time.Now().Format(time.RFC3339),
		})
	})

	userRepo := repository.NewInMemoryUserRepository()
	userService := service.NewUserService(userRepo)
  userController := controller.NewUserController(userService)

	mux.Handle("/api/users", userController)
	mux.Handle("/api/users/", userController)

	handler := middleware.LoggingMiddleware(mux)

	println("Layered Go service is running on http://localhost:8080")
	http.ListenAndServe(":8080", handler)
}