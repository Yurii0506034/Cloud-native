package main

import (
	"encoding/json"
	"net/http"
	"strconv"
	"sync"
	"time"
)

type Item struct {
	ID    int     `json:"id"`
	Name  string  `json:"name"`
	Price float64 `json:"price"`
}

var (
	items  = map[int]Item{1: {ID: 1, Name: "Laptop", Price: 1200}}
	mu     sync.Mutex
	nextID = 2
)

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/io", ioHandler)
	mux.HandleFunc("/cpu-sequential", cpuSequentialHandler)
	mux.HandleFunc("/cpu-parallel", cpuParallelHandler)

	println("Go service is running on http://localhost:8080")
	http.ListenAndServe(":8080", mux)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "OK",
		"service":   "go-service",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// Асинхронна I/O операція (/io) — імітація через time.Sleep
func ioHandler(w http.ResponseWriter, r *http.Request) {
	delayMs := 100
	if val := r.URL.Query().Get("delay"); val != "" {
		if d, err := strconv.Atoi(val); err == nil {
			delayMs = d
		}
	}
	time.Sleep(time.Duration(delayMs) * time.Millisecond)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service":   "go-service",
		"type":      "I/O operation",
		"delayMs":   delayMs,
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// Версія 1: Послідовне виконання кількох важких обчислень
func cpuSequentialHandler(w http.ResponseWriter, r *http.Request) {
	tasks := 4 // кількість послідовних циклів
	iterations := 200000000
	var totalCounter int64 = 0

	for t := 0; t < tasks; t++ {
		var localCounter int64 = 0
		for i := 0; i < iterations; i++ {
			localCounter++
		}
		totalCounter += localCounter
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "go-service",
		"type":    "CPU Sequential",
		"tasks":   tasks,
		"result":  totalCounter,
	})
}

// Версія 2: Паралельне виконання важких обчислень у горутинах (Goroutines)
func cpuParallelHandler(w http.ResponseWriter, r *http.Request) {
	tasks := 4
	iterations := 200000000
	var wg sync.WaitGroup
	var totalCounter int64 = 0
	var muCounter sync.Mutex

	for t := 0; t < tasks; t++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			var localCounter int64 = 0
			for i := 0; i < iterations; i++ {
				localCounter++
			}
			muCounter.Lock()
			totalCounter += localCounter
			muCounter.Unlock()
		}()
	}
	wg.Wait() // Чекаємо завершення всіх горутин

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "go-service",
		"type":    "CPU Parallel (Goroutines)",
		"tasks":   tasks,
		"result":  totalCounter,
	})
}