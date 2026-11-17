package service

import (
	"lab4/internal/model"
	"lab4/internal/repository"
	"testing"
)

func TestUserService_CreateAndGet(t *testing.T) {
	repo := repository.NewInMemoryUserRepository()
	s := NewUserService(repo)

	user := model.User{Name: "Alice", Email: "alice@example.com"}
	created, err := s.CreateUser(user)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	if created.ID == 0 {
		t.Errorf("Expected non-zero ID for created user")
	}

	fetched, err := s.GetUserByID(created.ID)
	if err != nil {
		t.Fatalf("Failed to fetch user by ID: %v", err)
	}

	if fetched.Name != "Alice" || fetched.Email != "alice@example.com" {
		t.Errorf("Fetched user data does not match original: got %+v", fetched)
	}
}

func TestUserService_DuplicateEmail(t *testing.T) {
	repo := repository.NewInMemoryUserRepository()
	s := NewUserService(repo)

	user := model.User{Name: "Bob", Email: "bob@example.com"}
	_, err := s.CreateUser(user)
	if err != nil {
		t.Fatalf("First user creation failed: %v", err)
	}

	// Спроба створити користувача з тим самим email
	_, err2 := s.CreateUser(model.User{Name: "Bobby", Email: "bob@example.com"})
	if err2 == nil {
		t.Errorf("Expected error due to duplicate email, got nil")
	}
}