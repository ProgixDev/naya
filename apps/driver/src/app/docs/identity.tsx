import { Redirect } from 'expo-router';

/** Kept for older links: personal details are now asked one question at a time. */
export default function IdentityDetails() {
  return <Redirect href={{ pathname: '/docs/step/[id]', params: { id: 'name' } }} />;
}
