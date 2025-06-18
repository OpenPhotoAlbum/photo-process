export interface FaceData {
  id: number;
  face_image_path: string;
  relative_face_path: string;
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
  detection_confidence: string;
  person_id?: number;
  person_name?: string;
  face_url: string;
}

export interface ImageFacesResponse {
  faces: FaceData[];
}

export interface FaceBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScaledFaceData extends FaceData {
  scaledBounds: FaceBoundingBox;
}