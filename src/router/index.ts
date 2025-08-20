import { createRouter, createWebHistory } from 'vue-router'
import routes from 'virtual:generated-pages'
import Profile from '../pages/[username].vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    ...routes,
    {
      path: '/@:username',
      name: 'user-profile',
      component: Profile,
      props: true
    }
  ],
})

export default router
