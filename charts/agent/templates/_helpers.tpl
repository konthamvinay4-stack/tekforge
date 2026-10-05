{{- define "tekforge-agent.name" -}}
tekforge-agent
{{- end -}}
{{- define "tekforge-agent.fullname" -}}
{{- printf "%s-%s" .Release.Name (include "tekforge-agent.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
