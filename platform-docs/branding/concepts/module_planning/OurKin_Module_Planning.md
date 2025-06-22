
# OurKin Ecosystem Modules: High-Level Planning

---

## 1️⃣ OurKin FamilyTree (Generational lineage & family visualization)

### Core Goals
- Visualize family relationships across multiple generations.
- Associate photos with people and life events.
- Build a browsable interactive tree.
- Make it feel like a digital family heirloom.

### Key Features
- Family Tree builder (simple drag-and-drop interface)
- Assign photos to individuals or family groups
- Life timeline view (showing photos across lifespans)
- Visual lineage viewer (e.g., "Margaret > her parents > their parents...")
- Event tagging (weddings, birthdays, reunions)

### Data Sources You'll Already Have
- Existing face/person metadata  
- Geolocation (photos at events)  
- Timestamps for life stages

---

## 2️⃣ OurKin PeopleStories (Personal narrative timeline module)

### Core Goals
- Tell the life story of each individual person.
- Allow for “narrative mode” browsing: “John’s Life Journey”
- Support storytelling beyond just photos.

### Key Features
- Auto-generate personal timelines from photo metadata
- Travel mapping (show where someone traveled over time)
- Add life milestones manually (graduation, marriage, children, etc.)
- Allow captions, notes, and short written stories for any milestone
- Display network of relationships (parents, siblings, children)

### Data Sources You'll Already Have
- Person recognition + face assignments
- Timestamps & locations
- Potential import of basic family history data (manual input or GEDCOM import)

---

## 3️⃣ OurKin AstroVault (Niche astrophotography product line)

### Core Goals
- Specialized storage, organization, and analysis for telescope-based astrophotographers.
- Capture deep technical metadata alongside photos.

### Key Features
- Metadata capture (telescope, mount, filters, camera, exposure settings)
- Sky condition overlays (Bortle scale, seeing conditions)
- Skill progression tracking
- Community sharing & commenting
- Quality scoring / image stacking logs
- Timeline view for progression of targets photographed

### Data Sources You'll Need
- Astro image EXIF metadata (or external importers)
- Third-party API integrations (weather data, seeing forecasts)

---

# Platform Architecture Notes

All of these modules rely on:

- Existing person database
- AI object & face recognition models
- Geolocation engine
- Modular microservice approach
- Shared identity/authentication model

You're essentially building an **"OurKin OS"** where:

- Photos are the shared core data layer.
- Each product module is simply a new way to interact with the data.

---

# Suggested Development Timeline

| Phase | Modules |
|-------|---------|
| Now (Core MVP) | OurKin Core (photo upload, face recognition, search, gallery) |
| Phase 1 (2025-26) | FamilyTree |
| Phase 2 (2026) | PeopleStories |
| Phase 3 (2027+) | AstroVault |

---

**Next Steps:**

- Build detailed feature roadmaps for each module  
- Map data models & backend service architecture  
- Design simple UI mockups for FamilyTree or PeopleStories  
- Draft APIs you'd need to extend your current system  
- Draft technical milestones for the next 18-24 months

---

*We can dive deeper into any of these modules on request!*
