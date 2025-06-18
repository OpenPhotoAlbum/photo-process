# Geolocation API

The geolocation system automatically links photos to geographic locations based on GPS coordinates embedded in image metadata. The system includes a comprehensive worldwide database with 45,000+ cities and provides spatial queries for finding nearby locations.

## Overview

When photos are processed, the platform:
1. **Extracts GPS coordinates** from EXIF metadata (latitude, longitude, altitude)
2. **Finds closest city** using spatial distance calculations 
3. **Links photos to locations** with confidence scoring based on distance
4. **Enables location-based search** for filtering photos by geography

## Database Structure

The geolocation system uses four interconnected tables:

- **`geo_countries`** - Country information (249 countries)
- **`geo_states`** - State/province data (5,120 states/provinces)  
- **`geo_cities`** - City database (45,000+ cities worldwide)
- **`image_geolocations`** - Links photos to cities with confidence scores

## API Endpoints

### Search Images by Location

Search for photos taken in specific geographic areas:

```http
GET /api/locations/search?state=CA&limit=50
GET /api/locations/search?cityId=31597
GET /api/locations/search?lat=37.7749&lng=-122.4194&radius=10
```

**Parameters:**
- `cityId` - Search by specific city ID
- `state` - State/province code (e.g., "CA", "NY", "TX")
- `country` - Country code (e.g., "US", "CA", "GB")
- `lat`, `lng` - GPS coordinates for radius search
- `radius` - Search radius in miles (default: 10)
- `limit` - Maximum results (default: 50)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "images": [
    {
      "id": 1,
      "filename": "IMG_001.jpg",
      "city": "San Francisco",
      "state_name": "California", 
      "country_name": "United States",
      "gps_latitude": 37.7749,
      "gps_longitude": -122.4194,
      "confidence_score": 0.95,
      "distance_miles": 0.5
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "count": 25
  }
}
```

### Location Statistics

Get aggregated statistics showing photo counts by location:

```http
GET /api/locations/stats
```

**Response:**
```json
{
  "locationStats": [
    {
      "city": "Austin",
      "state_name": "Texas",
      "country_name": "United States", 
      "photo_count": 150,
      "min_distance": 0.1,
      "max_distance": 2.5,
      "avg_distance": 0.8
    }
  ],
  "totalLocations": 59
}
```

### Find Closest City

Find the closest city to given GPS coordinates:

```http
GET /api/locations/closest?lat=37.7749&lng=-122.4194&radius=10
```

**Response:**
```json
{
  "city": {
    "id": 31597,
    "city": "San Francisco",
    "state_code": "CA",
    "postal_code": "94102",
    "distance_in_miles": 0.32
  },
  "location": {
    "cityId": 31597,
    "cityName": "San Francisco",
    "stateName": "California", 
    "stateCode": "CA",
    "countryName": "United States",
    "countryCode": "US",
    "fullLocationString": "San Francisco, California, United States"
  },
  "searchRadius": 10,
  "coordinates": {
    "latitude": 37.7749,
    "longitude": -122.4194
  }
}
```

### Image Location Details

Get location information for a specific image:

```http
GET /api/locations/images/456/location
```

**Response:**
```json
{
  "imageId": 456,
  "location": {
    "city": "Austin",
    "state": "Texas",
    "country": "United States",
    "coordinates": {
      "latitude": 30.2672,
      "longitude": -97.7431
    },
    "confidence": 0.94,
    "distance": 1.2
  }
}
```

### Retroactive Processing

Process geolocation for existing images that have GPS data but haven't been linked to cities yet:

```http
POST /api/locations/retroactive
Content-Type: application/json

{
  "limit": 100,
  "radius": 25
}
```

**Response:**
```json
{
  "message": "Retroactive geolocation processing completed",
  "totalImages": 100,
  "processed": 95,
  "skipped": 5,
  "searchRadius": 25
}
```

## Integration with Gallery API

The gallery API automatically includes location data in image responses:

```json
{
  "id": 1,
  "filename": "IMG_001.jpg",
  "location": {
    "city": "San Francisco",
    "state": "California",
    "country": "United States",
    "confidence": 0.95,
    "distance_miles": 0.5,
    "coordinates": {
      "latitude": 37.7749,
      "longitude": -122.4194
    }
  }
}
```

## Spatial Queries

The system uses MySQL's spatial functions for efficient geographic calculations:

```sql
-- Find cities within 10 miles of coordinates
SELECT *, ST_Distance_Sphere(
  POINT(longitude, latitude), 
  POINT(-122.4194, 37.7749)
) * 0.000621371 as distance_miles
FROM geo_cities 
WHERE ST_Distance_Sphere(
  POINT(longitude, latitude), 
  POINT(-122.4194, 37.7749)
) * 0.000621371 <= 10
ORDER BY distance_miles ASC;
```

## Confidence Scoring

Location matching uses distance-based confidence scoring:

- **Distance < 1 mile**: Confidence = 0.95-1.0 (Very High)
- **Distance 1-5 miles**: Confidence = 0.85-0.95 (High)
- **Distance 5-15 miles**: Confidence = 0.70-0.85 (Medium)  
- **Distance 15-25 miles**: Confidence = 0.50-0.70 (Low)
- **Distance > 25 miles**: No match (Below threshold)

## Mobile App Integration

The mobile app displays location information in photo details:

- **Map thumbnails** showing photo location
- **Location hierarchy** (City, State, Country)
- **Distance indicators** showing accuracy
- **GPS coordinate display** for technical details

## Future Enhancements

Planned improvements to the geolocation system:

1. **Manual Location Correction** - Allow users to override automatic city matching
2. **Additional Location Sources** - Landmarks, neighborhoods, points of interest
3. **Location-Based Smart Albums** - Auto-generated albums by city/region
4. **Travel Timeline** - Chronological location-based photo organization
5. **Weather Integration** - Historical weather data for photo locations

## Performance Considerations

- **Indexed spatial queries** for fast distance calculations
- **Cached location lookups** to reduce database load
- **Bulk processing** for retroactive geolocation
- **Confidence thresholds** to avoid false matches
- **Efficient join queries** in gallery API responses

## Data Sources

The geolocation database is sourced from:
- **GeoNames** - Worldwide geographic database
- **Natural Earth** - Country and state boundaries
- **OpenStreetMap** - City and locality data
- **Custom curation** - Major city corrections and additions