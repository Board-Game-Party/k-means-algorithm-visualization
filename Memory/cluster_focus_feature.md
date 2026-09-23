# Feature: Cluster Status Click-to-Focus

## Overview

เพิ่มความสามารถให้ **Status Bar ของ Cluster** (แถบแสดงสี + ชื่อ + จำนวนจุด) สามารถ **คลิกได้**  
เมื่อคลิกที่ Cluster ใด ๆ แล้ว Canvas จะ **Focus (ซูม + เลื่อน)** ไปยังกลุ่มจุดของ Cluster นั้นโดยอัตโนมัติ

---

## Current UI

### Status Bar (แถบสถานะ Cluster)

แสดง Cluster ทั้งหมดในแนวนอน พร้อมสี ชื่อ และจำนวน point

```
🔵 Cluster A  50    🩷 Cluster B  50    🟢 Cluster C  53
```

### Canvas (พื้นที่แสดง Scatter Plot)

แสดงจุดข้อมูลแต่ละ Cluster เป็นสีที่ตรงกับ Status Bar  
แต่ละ Cluster มี **Centroid** (จุดศูนย์กลาง) แสดงเป็นวงกลมซ้อน

---

## Proposed Behavior

### 1. Clickable Cluster Status

| Action | ผลลัพธ์ |
|---|---|
| **คลิก** ที่ Cluster ใดๆ บน Status Bar | Canvas จะ **zoom in + pan** ไปที่กลุ่มจุดของ Cluster นั้น |
| **คลิกซ้ำ** ที่ Cluster เดิม | Canvas จะ **zoom out กลับ** ไปแสดงภาพรวมทั้งหมด (reset view) |
| **Hover** บน Cluster Status | เปลี่ยน cursor เป็น `pointer` และ highlight สี ให้สว่างขึ้นเล็กน้อย |

### 2. Focus Animation

เมื่อคลิก Cluster แล้ว:

1. **คำนวณ Bounding Box** ของจุดทั้งหมดใน Cluster ที่เลือก
2. **Smooth Pan** เลื่อน Canvas ไปที่ตำแหน่ง Centroid ของ Cluster
3. **Smooth Zoom** ซูมเข้าให้จุดทั้งหมดของ Cluster พอดีกับ Viewport (มี padding ~10-15%)
4. **Highlight** จุดของ Cluster ที่เลือก ให้ชัดเจน
5. **Dim** จุดของ Cluster อื่น ๆ ให้จางลง (opacity ~0.2)

### 3. Active State Indicator

เมื่อ Cluster ถูกเลือก (focus อยู่):

- Status Bar ของ Cluster ที่เลือกจะมี **underline** หรือ **border highlight** เพื่อบอกสถานะ
- Cluster อื่น ๆ บน Status Bar จะจางลงเล็กน้อย

```
  🔵 Cluster A  50    [ 🩷 Cluster B  50 ]    🟢 Cluster C  53
                        ↑ active / focused
```

---

## Example Flow

```
ผู้ใช้คลิก "🩷 Cluster B 50" บน Status Bar
    │
    ├── 1. Canvas smooth-pan ไปที่ Centroid ของ Cluster B (สีชมพู)
    ├── 2. Canvas smooth-zoom ให้จุดสีชมพูทั้ง 50 จุดพอดีกับหน้าจอ
    ├── 3. จุดสีชมพู opacity = 1.0 (ชัดเจน)
    ├── 4. จุดสีอื่น opacity = 0.2 (จางลง)
    └── 5. Status Bar ของ Cluster B มี highlight border

ผู้ใช้คลิก "🩷 Cluster B 50" อีกครั้ง
    │
    ├── 1. Canvas zoom-out กลับไป fit ทุก Cluster
    ├── 2. ทุกจุด opacity = 1.0
    └── 3. Status Bar กลับสู่สถานะปกติ
```

---

## Technical Notes

### การคำนวณ Focus Area

```
focusX = ค่าเฉลี่ย X ของจุดทั้งหมดใน Cluster (= Centroid X)
focusY = ค่าเฉลี่ย Y ของจุดทั้งหมดใน Cluster (= Centroid Y)

minX = ค่า X น้อยสุดของจุดใน Cluster
maxX = ค่า X มากสุดของจุดใน Cluster
minY = ค่า Y น้อยสุดของจุดใน Cluster
maxY = ค่า Y มากสุดของจุดใน Cluster

padding = 15%
zoomLevel = คำนวณให้ (minX..maxX, minY..maxY) + padding พอดีกับ Viewport
```

### CSS สำหรับ Status Bar

```css
.cluster-status-item {
    cursor: pointer;
    transition: opacity 0.3s, transform 0.2s;
    user-select: none;
}

.cluster-status-item:hover {
    opacity: 0.8;
    transform: scale(1.05);
}

.cluster-status-item.active {
    border-bottom: 2px solid currentColor;
}

.cluster-status-item.dimmed {
    opacity: 0.4;
}
```

### Animation Duration

| Animation | Duration | Easing |
|---|---|---|
| Pan (เลื่อน) | 500ms | ease-in-out |
| Zoom (ซูม) | 500ms | ease-in-out |
| Opacity (จาง/ชัด) | 300ms | ease |
| Status highlight | 200ms | ease |

---

## Edge Cases

| สถานการณ์ | พฤติกรรม |
|---|---|
| Cluster มีจุดเดียว | Zoom in ไปที่จุดนั้นด้วย zoom level ที่เหมาะสม (ไม่ซูมจนเกินไป) |
| กดเปลี่ยน Cluster ขณะ animate อยู่ | ยกเลิก animation เดิม แล้ว animate ไป Cluster ใหม่ |
| Re-run K-means ขณะ focus อยู่ | Reset view กลับเป็นภาพรวม |
| Cluster ถูกลบ/เปลี่ยนจำนวน K | Reset focus state ทั้งหมด |
