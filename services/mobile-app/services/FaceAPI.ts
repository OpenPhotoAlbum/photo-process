import { ImageFacesResponse } from '../types/FaceTypes';
import { API_BASE } from '../config';

export class FaceAPI {
  static async getImageFaces(imageId: number): Promise<ImageFacesResponse> {
    try {
      const response = await fetch(`${API_BASE}/api/gallery/${imageId}/faces`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching image faces:', error);
      throw error;
    }
  }
}