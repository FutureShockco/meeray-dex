<script setup lang="ts">
// About page
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <h1 class="text-3xl font-bold mb-6">About MeeRayDEX</h1>
    
    <div class="card mb-8">
      <h2 class="text-xl font-bold mb-4">Our Mission</h2>
      <p class="mb-4">
        MeeRayDEX is a cross-platform mobile application designed to provide a seamless
        experience across iOS, Android, and web platforms. Built with the latest technologies 
        including Capacitor, Vue 3, and Nuxt 3, our app demonstrates the power of modern 
        web technologies for mobile development.
      </p>
      <p>
        Our mission is to showcase best practices in code organization, maintainability, 
        and performance while delivering a beautiful and intuitive user experience.
      </p>
    </div>
    
    <div class="card mb-8">
      <h2 class="text-xl font-bold mb-4">Technology Stack</h2>
      <ul class="list-disc pl-5 space-y-2">
        <li><strong>Capacitor:</strong> Native runtime for cross-platform apps</li>
        <li><strong>Vue 3:</strong> Progressive JavaScript framework with Composition API</li>
        <li><strong>Nuxt 3:</strong> Intuitive and powerful Vue framework</li>
        <li><strong>TypeScript:</strong> Type safety and developer experience</li>
        <li><strong>TailwindCSS:</strong> Utility-first CSS framework</li>
        <li><strong>Pinia:</strong> State management for Vue applications</li>
      </ul>
    </div>
    
    <div class="card">
      <h2 class="text-xl font-bold mb-4">Contact Us</h2>
      <p>
        Have questions or feedback? We'd love to hear from you!
      </p>
      <form class="mt-4 space-y-4">
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input type="text" id="name" class="input" />
        </div>
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" id="email" class="input" />
        </div>
        <div>
          <label for="message" class="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea id="message" rows="4" class="input"></textarea>
        </div>
        <button type="submit" class="btn-primary">Send Message</button>
      </form>
    </div>
  </div>
</template> 