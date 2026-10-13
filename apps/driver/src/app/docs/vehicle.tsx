import { Redirect } from 'expo-router';

/** Kept for older links: the vehicle is now asked one question at a time. */
export default function VehicleDetails() {
  return <Redirect href={{ pathname: '/docs/step/[id]', params: { id: 'vehicle_model' } }} />;
}
