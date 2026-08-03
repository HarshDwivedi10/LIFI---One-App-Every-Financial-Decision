package com.financeplanner.service;

import com.financeplanner.entity.GmailIntegration;
import com.financeplanner.entity.User;
import com.financeplanner.repository.GmailIntegrationRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

@Service
public class GmailAuthService {

    private final GmailIntegrationRepository repository;
    
    @Value("${google.client.id:default-id}")
    private String clientId;

    @Value("${google.redirect.uri:http://localhost:8080/api/gmail/callback}")
    private String redirectUri;

    public GmailAuthService(GmailIntegrationRepository repository) {
        this.repository = repository;
    }

    public String generateAuthorizationUrl() {
        // Simplified URL generation for demonstration purposes
        return "https://accounts.google.com/o/oauth2/auth?" +
                "client_id=" + clientId +
                "&redirect_uri=" + redirectUri +
                "&response_type=code" +
                "&scope=https://www.googleapis.com/auth/gmail.readonly" +
                "&access_type=offline" +
                "&prompt=consent";
    }

    public void handleCallback(User user, String code) {
        // In a real implementation, you would exchange this code for an access token
        // using the GoogleAuthorizationCodeFlow. 
        // We will simulate saving a mock token here.
        
        GmailIntegration integration = repository.findByUserId(user.getId())
                .orElse(new GmailIntegration());
                
        integration.setUser(user);
        integration.setAccessToken("mock_access_token_" + UUID.randomUUID().toString());
        integration.setRefreshToken("mock_refresh_token_" + UUID.randomUUID().toString());
        integration.setExpirationTimeMillis(System.currentTimeMillis() + 3600000); // 1 hour
        
        repository.save(integration);
    }
    
    public Optional<GmailIntegration> getIntegration(Long userId) {
        return repository.findByUserId(userId);
    }
}
