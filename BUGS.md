# BUGS.md - Known Issues and Bug Tracking

This file tracks known bugs, issues, and their resolution status in the Photo Management Platform.

## 🔴 Open Issues

### Mobile App

1. **Face Images API 404 Error**
   - **Description**: FacesScreen trying to fetch person images returns 404 error
   - **Error**: `error fetching person images: 404 FacesScreen.tsx`
   - **Endpoint**: `/api/persons/{id}/images` - endpoint should exist but returns 404
   - **Priority**: High
   - **Workaround**: None currently

### API/Backend

1. **CompreFace Person Sync**
   - **Description**: CompreFace doesn't have the same persons/subjects as our database
   - **Impact**: Face recognition may not work for all persons
   - **TODO**: Sync person names even without face images
   - **Priority**: High

## ✅ Recently Fixed

### Mobile App - Navigation

1. **Album Photo Navigation** (Fixed: 2025-06-20)
   - **Issue**: When viewing a photo from an album and closing it, user returned to main gallery instead of album
   - **Fix**: Added `albumBeforePhoto` state to save/restore album context
   - **Files**: `App.tsx`

2. **Hamburger Menu Location** (Fixed: 2025-06-20)
   - **Issue**: Hamburger menu was in header, user wanted it in bottom nav
   - **Fix**: Moved hamburger menu to bottom navigation bar, replaced settings icon
   - **Files**: `App.tsx`, `SlideOutMenu.tsx`

### Mobile App - Face Management

1. **Text String Rendering Error** (Fixed: 2025-06-20)
   - **Issue**: "Text strings must be rendered within a <Text> component" error on FacesScreen
   - **Cause**: Numbers and conditionals not properly converted to strings
   - **Fix**: Used `.toString()` for all numeric values, fixed conditional rendering
   - **Files**: `FacesScreen.tsx`

2. **Face Images Not Loading** (Fixed: 2025-06-20)
   - **Issue**: Face preview images showed placeholder instead of actual face images
   - **Cause**: Incorrect URL construction for face images
   - **Fix**: Updated `getFaceImageUrl` to use `/processed/` endpoint
   - **Files**: `FacesScreen.tsx`

### Mobile App - Albums

1. **Album Photos Not Showing** (Fixed: 2025-06-20)
   - **Issue**: Albums showed "No photos in this album" even when images existed
   - **Cause**: Missing URL construction from `relative_media_path`
   - **Fix**: Added fallback URL construction logic
   - **Files**: `AlbumDetailScreen.tsx`

2. **Album API 404 Errors** (Fixed: 2025-06-20)
   - **Issue**: Missing `/api` prefix in album API calls
   - **Fix**: Added `/api` prefix to all API endpoints
   - **Files**: `AlbumsScreen.tsx`

### Mobile App - UI/UX

1. **Modal Close Buttons Too High** (Fixed: 2025-06-20)
   - **Issue**: X buttons overlapped with iPhone status bar
   - **Fix**: Added SafeAreaView to all modal screens
   - **Files**: Multiple screen components

2. **Missing Album Preview Images** (Fixed: 2025-06-20)
   - **Issue**: Albums only showed folder icon, no preview of contents
   - **Fix**: Implemented dynamic album cover preview loading
   - **Files**: `AlbumsScreen.tsx`

## 🟡 Known Limitations

1. **Face Assignment Removal**
   - **Status**: API exists (`DELETE /api/faces/{faceId}/person`) but UI implementation pending
   - **Workaround**: Use API directly or web interface

2. **Google Photos Integration**
   - **Status**: Person images from Google Photos tags not displaying in mobile app
   - **Impact**: Can't see all photos tagged by Google for a person

## 📝 Notes

- When adding new bugs, include: Description, Steps to Reproduce, Expected vs Actual Behavior, Priority, and Workaround if any
- Mark fixed issues with date and brief description of fix
- Consider moving fixed issues to ACHIEVEMENTS.md after some time