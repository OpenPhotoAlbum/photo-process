import { ImageFacesResponse } from '../types/FaceTypes';

const API_BASE = 'http://192.168.40.103:9000';

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