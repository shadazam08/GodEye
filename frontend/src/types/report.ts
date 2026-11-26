// The reporter's estimate of pothole severity.
export type Severity = 'low' | 'medium' | 'high'

// A report's verification state.
export type ReportStatus = 'pending' | 'verified' | 'rejected'

// Data sent from the website to POST /api/reports.
export interface ReportCreate {
  title: string
  description: string
  location_name: string
  latitude: number
  longitude: number
  severity: Severity
}

// Data returned by the backend after saving a report.
export interface ReportRead extends ReportCreate {
  id: string
  status: ReportStatus
  created_at: string
  repaired_at: string | null
}