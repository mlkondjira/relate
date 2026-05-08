import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores';

export default function Index() {
  const { user } = useAuthStore();

  // Si l'utilisateur est connecté, on l'envoie sur le dashboard
  // Sinon, on l'envoie vers l'écran de login
  return user 
    ? <Redirect href="/app/home" /> 
    : <Redirect href="/auth/login" />;
}