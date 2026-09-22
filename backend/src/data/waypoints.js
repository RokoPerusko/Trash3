// ENT (Ericsson Nikola Tesla) - drone starting point
const ENT = { lat: 45.803350, lng: 15.946751, label: 'ENT - Ericsson Nikola Tesla' };

// Destination (FER)
const FER = { lat: 45.800552, lng: 15.970934, label: 'FER' };

// Route ENT -> FER. WP-MUP sits deliberately close to the SIM cluster
// (near the Ministry of the Interior) so the cluster is intersected by the flight path.
const DEFAULT_ROUTE = [
  ENT,
  { lat: 45.802371, lng: 15.955215, label: 'WP1' },
  { lat: 45.801374, lng: 15.963825, label: 'WP-MUP' },
  { lat: 45.800832, lng: 15.968516, label: 'WP2' },
  FER,
];

// Location where the dense SIM cluster is generated - near the Ministry of the Interior,
// intentionally on top of the drone route (WP-MUP)
const CLUSTER_LOCATION = { lat: 45.800580, lng: 15.963825 };

module.exports = { ENT, FER, DEFAULT_ROUTE, CLUSTER_LOCATION };
