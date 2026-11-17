package repository

import (
	"errors"
	"lab4/internal/model"
	"sync"
)

// UserRepository інтерфейс для ізоляції Service від конкретної реалізації зберігання
type UserRepository interface {
	Create(user model.User) (model.User, error)
	FindAll() ([]model.User, error)
	FindByID(id int) (model.User, error)
	Update(user model.User) (model.User, error)
	Delete(id int) error
}

type InMemoryUserRepository struct {
	mu     sync.RWMutex
	users  map[int]model.User
	nextID int
}

func NewInMemoryUserRepository() *InMemoryUserRepository {
	return &InMemoryUserRepository{
		users:  make(map[int]model.User),
		nextID: 1,
	}
}

func (r *InMemoryUserRepository) Create(user model.User) (model.User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, u := range r.users {
		if u.Email == user.Email {
			return model.User{}, errors.New("conflict: user with this email already exists")
		}
	}

	user.ID = r.nextID
	r.nextID++
	r.users[user.ID] = user
	return user, nil
}

func (r *InMemoryUserRepository) FindAll() ([]model.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	users := make([]model.User, 0, len(r.users))
	for _, u := range r.users {
		users = append(users, u)
	}
	return users, nil
}

func (r *InMemoryUserRepository) FindByID(id int) (model.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	user, exists := r.users[id]
	if !exists {
		return model.User{}, errors.New("not_found: user not found")
	}
	return user, nil
}

func (r *InMemoryUserRepository) Update(user model.User) (model.User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.users[user.ID]; !exists {
		return model.User{}, errors.New("not_found: user not found")
	}
	r.users[user.ID] = user
	return user, nil
}

func (r *InMemoryUserRepository) Delete(id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.users[id]; !exists {
		return errors.New("not_found: user not found")
	}
	delete(r.users, id)
	return nil
}