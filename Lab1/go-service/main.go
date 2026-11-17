package main

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Item struct {
	ID    int     `json:"id"`
	Name  string  `json:"name"`
	Price float64 `json:"price"`
}

type MemoryStore struct {
	mu     sync.Mutex
	items  map[int]Item
	nextID int
}

var store = MemoryStore{
	items: map[int]Item{
		1: {ID: 1, Name: "Laptop", Price: 1200},
		2: {ID: 2, Name: "Mechanical Keyboard", Price: 150},
	},
	nextID: 3,
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/health", healthCheckHandler)
	mux.HandleFunc("/items", itemsHandler)
	mux.HandleFunc("/items/", itemDetailHandler)

	server := &http.Server{
		Addr:         ":8080",
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	println("Go service is running on http://localhost:8080")
	if err := server.ListenAndServe(); err != nil {
		println("Server failed:", err.Error())
	}
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "OK",
		"service":   "go-service",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

func itemsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		store.mu.Lock()
		itemList := make([]Item, 0, len(store.items))
		for _, item := range store.items {
			itemList = append(itemList, item)
		}
		store.mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(itemList)

	case http.MethodPost:
		var newItem Item
		if err := json.NewDecoder(r.Body).Decode(&newItem); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if newItem.Name == "" || newItem.Price <= 0 {
			http.Error(w, "Name and valid price are required", http.StatusBadRequest)
			return
		}

		store.mu.Lock()
		newItem.ID = store.nextID
		store.nextID++
		store.items[newItem.ID] = newItem
		store.mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(newItem)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func itemDetailHandler(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/items/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}

	id, err := strconv.Atoi(parts[0])
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	item, exists := store.items[id]

	switch r.Method {
	case http.MethodGet:
		if !exists {
			http.Error(w, `{"error":"Item not found"}`, http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(item)

	case http.MethodPut:
		if !exists {
			http.Error(w, `{"error":"Item not found"}`, http.StatusNotFound)
			return
		}
		var updatedItem Item
		if err := json.NewDecoder(r.Body).Decode(&updatedItem); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if updatedItem.Name != "" {
			item.Name = updatedItem.Name
		}
		if updatedItem.Price > 0 {
			item.Price = updatedItem.Price
		}
		store.items[id] = item

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(item)

	case http.MethodDelete:
		if !exists {
			http.Error(w, `{"error":"Item not found"}`, http.StatusNotFound)
			return
		}
		delete(store.items, id)
		w.WriteHeader(http.StatusNoContent)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}