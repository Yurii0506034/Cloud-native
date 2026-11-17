package main

import (
	"context"
	"flag"
	"fmt"
	"sync"
	"time"
)

type Job struct {
	ID    int
	Value int
}

type Result struct {
	JobID int
	Value int
}

// Виправляємо синтаксис оголошення каналів у воркері
func worker(ctx context.Context, id int, jobs <-chan Job, results chan<- Result, wg *sync.WaitGroup) {
	defer wg.Done()
	for {
		select {
		case <-ctx.Done():
			return
		case job, ok := <-jobs:
			if !ok {
				return
			}
			resValue := job.Value * job.Value

			select {
			case results <- Result{JobID: job.ID, Value: resValue}:
			case <-ctx.Done():
				return
			}
		}
	}
}

func main() {
	tasksCount := flag.Int("tasks", 10000, "Number of tasks to generate")
	workersCount := flag.Int("workers", 4, "Number of worker goroutines")
	bufferSize := flag.Int("buffer", 0, "Channel buffer size")
	flag.Parse()

	fmt.Printf("Starting Pipeline -> Tasks: %d, Workers: %d, Buffer: %d\n", *tasksCount, *workersCount, *bufferSize)

	jobs := make(chan Job, *bufferSize)
	results := make(chan Result, *bufferSize)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var wgWorkers sync.WaitGroup

	for w := 1; w <= *workersCount; w++ {
		wgWorkers.Add(1)
		go worker(ctx, w, jobs, results, &wgWorkers)
	}

	startTime := time.Now()
	go func() {
		for i := 1; i <= *tasksCount; i++ {
			select {
			case jobs <- Job{ID: i, Value: i}:
			case <-ctx.Done():
				close(jobs)
				return
			}
		}
		close(jobs)
	}()

	go func() {
		wgWorkers.Wait()
		close(results)
	}()

	var completedTasks int64 = 0
	var totalSum int64 = 0

	for res := range results {
		completedTasks++
		totalSum += int64(res.Value)
	}

	duration := time.Since(startTime)

	fmt.Println("========================================")
	fmt.Printf("Completed Tasks: %d\n", completedTasks)
	fmt.Printf("Total Accumulated Value: %d\n", totalSum)
	fmt.Printf("Processing Time: %d ms\n", duration.Milliseconds())
	fmt.Println("========================================")
}