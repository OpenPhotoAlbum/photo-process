# Migration Guide: SMB Sync to Auto-Upload

This guide helps you transition from SMB-based photo syncing to the new Auto-Upload system in the Photo Platform mobile app.

## Overview

The Photo Platform is transitioning from folder-based SMB synchronization to a modern auto-upload system that provides:
- ✅ Automatic background photo uploads
- ✅ Smart duplicate detection
- ✅ WiFi-preferred uploading with cellular fallback
- ✅ Progress tracking and retry logic
- ✅ No manual folder management required

## Prerequisites

Before migrating, ensure you have:
1. The Photo Platform mobile app installed (standalone version, not Expo Go)
2. Full photo library access granted to the app
3. Your photo server running and accessible
4. All existing photos already processed through SMB sync

## Migration Strategy

### Phase 1: Preparation (Before Enabling Auto-Upload)

1. **Complete Existing SMB Sync**
   - Ensure all photos in your SMB sync folders are fully processed
   - Check the platform dashboard for any pending or failed photos
   - Run a final manual sync if needed

2. **Verify Duplicate Detection**
   - The auto-upload system uses SHA-256 hashing to detect duplicates
   - Photos already processed via SMB will be recognized and skipped
   - No re-processing of existing photos will occur

3. **Document Current Setup**
   - Note your current SMB folder structure
   - Record any custom organization patterns
   - Save your SMB sync configuration for reference

### Phase 2: Enable Auto-Upload

1. **Open Mobile App Settings**
   ```
   Photos Tab → Settings Icon → Auto-Upload Settings
   ```

2. **Configure Auto-Upload**
   - Enable Auto-Upload: Toggle ON
   - Set Upload Quality: Original (recommended) or Compressed
   - WiFi Only: Toggle based on your preference
   - Monthly Data Limit: Set if using cellular uploads

3. **Initial Sync**
   - The app will scan your photo library
   - Existing photos (already uploaded via SMB) will be marked as duplicates
   - Only new photos will be queued for upload

### Phase 3: Transition Period

During the transition, you can run both systems in parallel:

1. **Continue SMB Sync** (temporarily)
   - Keep your existing SMB sync running for 1-2 weeks
   - Monitor that auto-upload is catching all new photos
   - Compare photo counts between both systems

2. **Monitor Auto-Upload**
   - Check upload queue regularly
   - Verify photos appear in the platform after upload
   - Review any failed uploads and retry if needed

3. **Gradual Migration**
   - New photos: Handled by auto-upload
   - Existing photos: Remain in SMB structure
   - No action needed for already-processed photos

### Phase 4: Complete Migration

1. **Disable SMB Sync**
   - After confirming auto-upload reliability (1-2 weeks)
   - Stop the SMB sync service/script
   - Remove SMB sync scheduled tasks

2. **Archive SMB Folders** (Optional)
   - Keep SMB folders as backup for 30 days
   - After verification, these can be removed
   - The platform maintains all photos in its processed structure

3. **Clean Up**
   - Remove SMB sync configurations
   - Update any documentation/scripts
   - Notify other family members of the change

## Handling Edge Cases

### Duplicate Photos
- **Scenario**: Same photo exists in both SMB and camera roll
- **Solution**: Auto-upload detects duplicates via hash comparison
- **Result**: Photo skipped, no duplicate processing

### Modified Photos
- **Scenario**: Photo edited after SMB sync
- **Solution**: Edited version treated as new photo
- **Result**: Both versions preserved in platform

### Missing EXIF Data
- **Scenario**: Photos without date/location metadata
- **Solution**: Platform extracts dates from filenames
- **Result**: Photos still organized correctly

### Large Video Files
- **Scenario**: Videos over 100MB
- **Solution**: Upload on WiFi only, with resume capability
- **Result**: Reliable upload even for large files

## Rollback Plan

If you need to revert to SMB sync:

1. **Disable Auto-Upload**
   - Toggle off in mobile app settings
   - Prevents new uploads

2. **Re-enable SMB Sync**
   - Restart your SMB sync service
   - Point to camera roll export location

3. **Sync Missing Photos**
   - Identify photos uploaded via auto-upload
   - Export from platform if needed
   - Resume normal SMB operations

## Benefits After Migration

### Immediate Benefits
- ✨ No manual folder management
- ✨ Automatic background processing
- ✨ Real-time photo availability
- ✨ Mobile-first experience

### Long-term Benefits
- 📱 Works with iCloud Photo Library
- 🔄 Automatic retry for failed uploads
- 📊 Upload statistics and monitoring
- 🔐 Secure, authenticated uploads

## Frequently Asked Questions

### Q: Will my existing photos be re-uploaded?
**A**: No. The platform's duplicate detection (SHA-256 hashing) ensures existing photos are recognized and skipped.

### Q: Can I use both systems simultaneously?
**A**: Yes, during the transition period. However, long-term use of both systems is not recommended to avoid confusion.

### Q: What happens to my folder organization?
**A**: The platform maintains its own organization (by date/hash). Your source folders remain unchanged.

### Q: How do I know if auto-upload is working?
**A**: Check the upload queue in the app, monitor the photo count on the platform dashboard, and verify new photos appear after taking them.

### Q: What if I have photos on multiple devices?
**A**: Install the app on each device and enable auto-upload. Duplicate detection works across all devices.

## Support

If you encounter issues during migration:

1. Check the mobile app's debug panel for error logs
2. Verify server connectivity and authentication
3. Review the platform logs for processing errors
4. Consult the [Troubleshooting Guide](./docs-site/docs/troubleshooting.md)

## Timeline Recommendation

- **Week 1**: Enable auto-upload, run parallel with SMB
- **Week 2**: Monitor both systems, verify reliability
- **Week 3**: Disable SMB sync, rely on auto-upload
- **Week 4**: Clean up and archive SMB folders

---

*Remember: The platform's duplicate detection ensures a safe migration. Your photos are protected throughout the transition.*