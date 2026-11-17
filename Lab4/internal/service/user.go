package service

import (
	"lab4/internal/model"
	"lab4/internal/repository"
)

type UserService struct {
	repo repository.UserRepository
}

func NewUserService(repo repository.UserRepository) *UserService {
	return &UserService{repo: repo}
}

func (s *UserService) CreateUser(user model.User) (model.User, error) {
	return s.repo.Create(user)
}

func (s *UserService) GetUsers() ([]model.User, error) {
	return s.repo.FindAll()
}

func (s *UserService) GetUserByID(id int) (model.User, error) {
	return s.repo.FindByID(id)
}

func (s *UserService) UpdateUser(user model.User) (model.User, error) {
	return s.repo.Update(user)
}

func (s *UserService) DeleteUser(id int) error {
	return s.repo.Delete(id)
}
