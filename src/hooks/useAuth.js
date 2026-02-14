import { useQuery } from '@tanstack/react-query'
import { authAPI } from '../services/api'

export function useAuth() {
  return useQuery({
    queryKey: ['auth'],
    queryFn: () => authAPI.getMe().then(res => res.data),
    enabled: !!localStorage.getItem('token'),
  })
}
