package httpapi

import (
	"encoding/json"
	"net/http"
	"reflect"
)

// writeJSON encodes v as the response body. A nil slice (sqlc's zero value
// for "no rows found") is normalized to an empty slice first, so list
// endpoints always send `[]` rather than `null` — frontend code can then
// always safely call .map()/.length on a list response without a null
// check.
func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(normalizeNilSlice(v))
}

func normalizeNilSlice(v interface{}) interface{} {
	rv := reflect.ValueOf(v)
	if rv.Kind() == reflect.Slice && rv.IsNil() {
		return reflect.MakeSlice(rv.Type(), 0, 0).Interface()
	}
	return v
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
