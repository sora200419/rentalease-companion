export type ComparisonPhoto = {
  id: string
  imageUrl: string
  room: string
  caption: string | null
}

export type RoomGroup = {
  roomLabel: string
  moveInPhotos: ComparisonPhoto[]
  moveOutPhotos: ComparisonPhoto[]
}

export type ComparisonResult = {
  matched: RoomGroup[]
  moveInOnly: RoomGroup[]
  moveOutOnly: RoomGroup[]
}

export type MoveInBaselineWarning = {
  tone: 'danger'
  title: string
  message: string
}

export function getMoveInBaselineWarning(
  moveInStatus: string,
): MoveInBaselineWarning | null {
  if (moveInStatus !== 'DISPUTED') return null

  return {
    tone: 'danger',
    title: 'Move-in baseline is disputed',
    message:
      'Review both original move-in evidence and counter evidence before deciding deposit deductions.',
  }
}

export function groupPhotosForComparison(
  moveInPhotos: ComparisonPhoto[],
  moveOutPhotos: ComparisonPhoto[],
): ComparisonResult {
  const normalise = (s: string) => s.trim().toLowerCase()

  const groups = new Map<
    string,
    { displayLabel: string; moveIn: ComparisonPhoto[]; moveOut: ComparisonPhoto[] }
  >()

  for (const photo of moveInPhotos) {
    const key = normalise(photo.room)
    if (!groups.has(key)) {
      groups.set(key, { displayLabel: photo.room, moveIn: [], moveOut: [] })
    }
    groups.get(key)!.moveIn.push(photo)
  }

  for (const photo of moveOutPhotos) {
    const key = normalise(photo.room)
    if (!groups.has(key)) {
      groups.set(key, { displayLabel: photo.room, moveIn: [], moveOut: [] })
    }
    groups.get(key)!.moveOut.push(photo)
  }

  const matched: RoomGroup[] = []
  const moveInOnly: RoomGroup[] = []
  const moveOutOnly: RoomGroup[] = []

  Array.from(groups.values()).forEach(({ displayLabel, moveIn, moveOut }) => {
    const group: RoomGroup = {
      roomLabel: displayLabel,
      moveInPhotos: moveIn,
      moveOutPhotos: moveOut,
    }
    if (moveIn.length > 0 && moveOut.length > 0) {
      matched.push(group)
    } else if (moveIn.length > 0) {
      moveInOnly.push(group)
    } else {
      moveOutOnly.push(group)
    }
  })

  const byLabel = (a: RoomGroup, b: RoomGroup) =>
    a.roomLabel.localeCompare(b.roomLabel)
  matched.sort(byLabel)
  moveInOnly.sort(byLabel)
  moveOutOnly.sort(byLabel)

  return { matched, moveInOnly, moveOutOnly }
}
