export type ReportPhoto = {
  id: string
  report_id: string
  width: number
  height: number
  byte_size: number
  created_at: string
}

export type ReportPhotoPreview = {
  photo_id: string
  url: string
  expires_at: number
}