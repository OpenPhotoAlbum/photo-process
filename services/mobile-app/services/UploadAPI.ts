import { API_BASE } from '../config';

export interface UploadResponse {
  success: boolean;
  imageId?: number;
  duplicate?: boolean;
  existingImageId?: number;
  message?: string;
  upload?: {
    originalFilename: string;
    fileSize: number;
    uploadedAt: string;
  };
  processing?: {
    mode: string;
    fileHash: string;
    relativePath: string;
    faceCount: number;
    objectCount: number;
    screenshotDetected: boolean;
    dominantColor?: string;
  };
  media?: {
    url: string;
    thumbnailUrl: string;
  };
  metadata?: {
    width?: number;
    height?: number;
    camera?: string;
    dateTaken?: string;
  };
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

class UploadAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE;
  }

  /**
   * Upload a photo to be processed
   */
  async uploadPhoto(
    uri: string, 
    filename: string = 'photo.jpg',
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResponse> {
    const formData = new FormData();
    
    // Add the photo file
    formData.append('photo', {
      uri,
      type: 'image/jpeg', // Default to JPEG, could be enhanced to detect actual type
      name: filename,
    } as any);

    // Add current timestamp as dateTaken if not provided in EXIF
    const now = new Date().toISOString();
    formData.append('dateTaken', now);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress: UploadProgress = {
              loaded: event.loaded,
              total: event.total,
              percentage: Math.round((event.loaded / event.total) * 100),
            };
            onProgress(progress);
          }
        });
      }

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error('Failed to parse response JSON'));
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            reject(new Error(errorResponse.message || `Upload failed with status ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      // Handle timeout
      xhr.addEventListener('timeout', () => {
        reject(new Error('Upload timeout'));
      });

      // Configure and send request
      xhr.open('POST', `${this.baseUrl}/api/process/upload`);
      xhr.timeout = 60000; // 60 second timeout
      xhr.send(formData);
    });
  }

  /**
   * Get processing status for an uploaded image
   */
  async getProcessingStatus(imageId: number): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/process/${imageId}/status`);
      
      if (!response.ok) {
        throw new Error(`Failed to get processing status: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting processing status:', error);
      throw error;
    }
  }
}

export const uploadAPI = new UploadAPI();