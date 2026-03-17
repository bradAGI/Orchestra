// Package observability provides a lightweight publish-subscribe event bus
// used to broadcast orchestrator state changes and agent events to SSE clients.
package observability

import (
	"sync"
	"time"
)

// Event represents a typed, timestamped message that can be published to
// subscribers. The Data field carries the event-specific payload.
type Event struct {
	Type      string `json:"type"`
	Timestamp string `json:"timestamp"`
	Data      any    `json:"data,omitempty"`
}

// PubSub is a thread-safe, in-memory publish-subscribe hub. Subscribers receive
// events on buffered channels; slow consumers have events dropped silently.
type PubSub struct {
	mu   sync.RWMutex
	subs map[chan Event]struct{}
}

// NewPubSub creates a new PubSub instance with no initial subscribers.
func NewPubSub() *PubSub {
	return &PubSub{subs: map[chan Event]struct{}{}}
}

// Subscribe creates a new buffered channel for receiving events and returns it
// along with an unsubscribe function. The buffer parameter controls channel
// capacity; values <= 0 default to 32.
func (p *PubSub) Subscribe(buffer int) (<-chan Event, func()) {
	if buffer <= 0 {
		buffer = 32
	}
	ch := make(chan Event, buffer)
	p.mu.Lock()
	p.subs[ch] = struct{}{}
	p.mu.Unlock()

	unsubscribe := func() {
		p.mu.Lock()
		if _, ok := p.subs[ch]; ok {
			delete(p.subs, ch)
			close(ch)
		}
		p.mu.Unlock()
	}

	return ch, unsubscribe
}

// Publish sends the event to all active subscribers. If a subscriber's channel
// is full, the event is dropped for that subscriber. A timestamp is set
// automatically if the event does not already have one.
func (p *PubSub) Publish(event Event) {
	if event.Timestamp == "" {
		event.Timestamp = time.Now().UTC().Format(time.RFC3339)
	}

	p.mu.RLock()
	defer p.mu.RUnlock()
	for ch := range p.subs {
		select {
		case ch <- event:
		default:
		}
	}
}
