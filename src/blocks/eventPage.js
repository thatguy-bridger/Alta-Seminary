import { createBlock } from './registry.js';

// The layout every event page starts with: the live details, then the live
// photos. Both read the event by id, so there's no text here to go stale.
// Used in two places: the public page when an event has never had its page
// customized (so every published event has a working page without anyone
// authoring one), and the page editor's first open, which starts from these
// same two blocks so there's a real layout to build on rather than a blank canvas.
export function defaultEventBlocks(eventId) {
  const details = createBlock('event-details');
  details.props.eventId = eventId;
  details.layout.spacing = 'sm';
  const photos = createBlock('event-photos');
  photos.props.eventId = eventId;
  return [details, photos];
}

