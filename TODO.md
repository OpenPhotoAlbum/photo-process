# Platform TODO List

This file tracks current development priorities and tasks for the Photo Management Platform.

## 🔥 High Priority

### ✅ Documentation Website
- [x] Generate documentation website using Docusaurus
- [x] Set up basic structure and navigation
- [x] Copy existing documentation into proper format
- [x] Configure for Photo Management Platform branding
- **Status**: Complete - Running at http://localhost:3000/

### 🔍 Training Management Endpoints
- [ ] Investigate Training Management endpoints - at least one is broken
- [ ] Clarify purpose of training management system
- [ ] Fix broken endpoints and improve error handling
- **Purpose**: Training Management handles CompreFace face recognition model training:
  - Manage face training data (add/remove face examples for people)
  - Trigger model retraining when new faces are tagged
  - Monitor training status and history
  - Critical for face recognition accuracy improvements

### 🛠️ Platform Development

- [ ] Build React frontend in services/web-app/ with TypeScript
- [ ] Test and improve scan functionality with real photo processing
- [ ] Fix remaining platform tools that have config manager import issues

## 📋 Medium Priority

### 🔧 Technical Improvements
- [ ] Add linting setup and configuration for the platform
- [ ] Add comprehensive API error handling and validation
- [ ] Implement advanced search with filters for objects, faces, dates
- [ ] Add smart album auto-generation based on content analysis
- [ ] Optimize face clustering to use CompreFace recognition for better accuracy

## 📝 Notes

- **Documentation Priority**: Always keep documentation website updated with any platform changes
- **Config Issues**: Many platform tools need migration from build imports to direct knex configuration
- **Testing**: Unit test suite is fully functional (93/93 tests passing)
- **Architecture**: Successfully migrated from legacy monolith to platform microservices

---
*Last Updated: 2025-06-17*
*Maintained by: Claude Code Development Session*