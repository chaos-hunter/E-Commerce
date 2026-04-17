package com.example.cis4900.spring.template.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.AsyncSupportConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void configureAsyncSupport(AsyncSupportConfigurer configurer) {
        // Set default async request timeout to 10 minutes to allow large exports on slower machines
        configurer.setDefaultTimeout(10 * 60 * 1000L);
    }
}
