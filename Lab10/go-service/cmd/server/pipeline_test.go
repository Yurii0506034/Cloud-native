package main

import (
    "context"
    "testing"
    "time"
)

func TestRunPipelineNoRace(t *testing.T) {
    ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
    defer cancel()

    processed, sum, err := runPipeline(ctx, 25, 4)
    if err != nil {
        t.Fatalf("unexpected pipeline error: %v", err)
    }
    if processed != 25 {
        t.Fatalf("expected 25 processed items, got %d", processed)
    }
    // sum of 2*k for k=1..25 is 2 * (25*26/2) = 650
    if sum != 650 {
        t.Fatalf("expected sum 650, got %d", sum)
    }
}