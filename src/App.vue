
<template>
  <div class="min-h-screen bg-white dark:bg-gray-950 dark:text-white mt-16">
    <AppNavbar>
      <template #logo>
        <span class="font-extrabold text-2xl tracking-tight text-primary-400">MeeRayDEX</span>
      </template>
    </AppNavbar>
    <router-view class="container mx-auto pt-16"/>

    <footer class="bg-gray-100 border-t mt-auto">
      <div class="container mx-auto px-4 py-6">
        <div class="flex flex-col md:flex-row justify-between items-center text-gray-600">
          <div class="mb-4 md:mb-0">
            <p>&copy; {{ new Date().getFullYear() }} MeeRayDEX</p>
          </div>
          <div class="flex gap-6">
            <router-link to="/witnesses" class="text-gray-600 hover:text-primary-500 transition-colors">
              Witnesses
            </router-link>
            <router-link to="/about" class="text-gray-600 hover:text-primary-500 transition-colors">
              About
            </router-link>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>