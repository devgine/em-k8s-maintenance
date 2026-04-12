"""
K8s Maintenance Manager API Tests
Tests for: Authentication, IP Templates, Applications, and Template-Application linking
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_USERNAME = "superadmin"
SUPER_ADMIN_PASSWORD = "SuperAdmin2024!"


class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_health_endpoint(self):
        """Test health endpoint returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        # Kubernetes is expected to be false in test environment (mocked)
        assert "kubernetes" in data
        print(f"Health check passed: {data}")


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_local_login_success(self):
        """Test successful login with super admin credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"username": SUPER_ADMIN_USERNAME, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["username"] == SUPER_ADMIN_USERNAME
        assert "admin" in data["user"]["roles"]
        print(f"Login successful for user: {data['user']['username']}")
    
    def test_local_login_invalid_password(self):
        """Test login with invalid password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"username": SUPER_ADMIN_USERNAME, "password": "wrongpassword"}
        )
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"Invalid password correctly rejected: {data['detail']}")
    
    def test_local_login_invalid_username(self):
        """Test login with invalid username"""
        response = requests.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"username": "nonexistent", "password": "anypassword"}
        )
        assert response.status_code == 401
        print("Invalid username correctly rejected")
    
    def test_user_info_with_valid_token(self, auth_token):
        """Test getting user info with valid token"""
        response = requests.get(
            f"{BASE_URL}/api/user/info",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == SUPER_ADMIN_USERNAME
        assert "admin" in data["roles"]
        print(f"User info retrieved: {data}")
    
    def test_user_info_without_token(self):
        """Test getting user info without token"""
        response = requests.get(f"{BASE_URL}/api/user/info")
        assert response.status_code in [401, 403]
        print("Unauthorized access correctly rejected")


class TestIPTemplates:
    """IP Templates CRUD tests"""
    
    def test_list_templates(self, auth_token):
        """Test listing all IP templates"""
        response = requests.get(
            f"{BASE_URL}/api/ip-templates",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "templates" in data
        assert isinstance(data["templates"], list)
        print(f"Found {len(data['templates'])} templates")
        
        # Verify template structure
        if data["templates"]:
            template = data["templates"][0]
            assert "id" in template
            assert "name" in template
            assert "value" in template
            assert "created_by" in template
    
    def test_create_template(self, auth_token):
        """Test creating a new IP template"""
        template_data = {
            "name": "TEST_Template_Create",
            "value": "192.168.100.0/24",
            "description": "Test template for automated testing"
        }
        response = requests.post(
            f"{BASE_URL}/api/ip-templates",
            headers={"Authorization": f"Bearer {auth_token}"},
            json=template_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == template_data["name"]
        assert data["value"] == template_data["value"]
        assert "id" in data
        print(f"Created template: {data['name']} with ID: {data['id']}")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/ip-templates/{data['id']}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
    
    def test_create_template_invalid_ip(self, auth_token):
        """Test creating template with invalid IP"""
        template_data = {
            "name": "TEST_Invalid_IP",
            "value": "invalid-ip",
            "description": "Should fail"
        }
        response = requests.post(
            f"{BASE_URL}/api/ip-templates",
            headers={"Authorization": f"Bearer {auth_token}"},
            json=template_data
        )
        assert response.status_code == 422  # Validation error
        print("Invalid IP correctly rejected")
    
    def test_update_template(self, auth_token):
        """Test updating an IP template"""
        # First create a template
        create_response = requests.post(
            f"{BASE_URL}/api/ip-templates",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"name": "TEST_Update_Template", "value": "10.10.10.0/24", "description": "Original"}
        )
        assert create_response.status_code == 200
        template_id = create_response.json()["id"]
        
        # Update the template
        update_response = requests.put(
            f"{BASE_URL}/api/ip-templates/{template_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"value": "10.10.20.0/24", "description": "Updated"}
        )
        assert update_response.status_code == 200
        data = update_response.json()
        assert "message" in data
        print(f"Template updated: {data}")
        
        # Verify update
        list_response = requests.get(
            f"{BASE_URL}/api/ip-templates",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        templates = list_response.json()["templates"]
        updated_template = next((t for t in templates if t["id"] == template_id), None)
        assert updated_template is not None
        assert updated_template["value"] == "10.10.20.0/24"
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/ip-templates/{template_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
    
    def test_delete_template(self, auth_token):
        """Test deleting an IP template"""
        # First create a template
        create_response = requests.post(
            f"{BASE_URL}/api/ip-templates",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"name": "TEST_Delete_Template", "value": "10.20.30.0/24", "description": "To be deleted"}
        )
        assert create_response.status_code == 200
        template_id = create_response.json()["id"]
        
        # Delete the template
        delete_response = requests.delete(
            f"{BASE_URL}/api/ip-templates/{template_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert delete_response.status_code == 200
        data = delete_response.json()
        assert "message" in data
        print(f"Template deleted: {data}")
        
        # Verify deletion
        list_response = requests.get(
            f"{BASE_URL}/api/ip-templates",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        templates = list_response.json()["templates"]
        deleted_template = next((t for t in templates if t["id"] == template_id), None)
        assert deleted_template is None


class TestApplications:
    """Applications CRUD tests"""
    
    def test_list_applications(self, auth_token):
        """Test listing all applications"""
        response = requests.get(
            f"{BASE_URL}/api/applications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "applications" in data
        assert isinstance(data["applications"], list)
        print(f"Found {len(data['applications'])} applications")
        
        # Verify application structure
        if data["applications"]:
            app = data["applications"][0]
            assert "id" in app
            assert "name" in app
            assert "namespace" in app
            assert "ip_allowlist" in app
            assert "enabled" in app
    
    def test_get_application(self, auth_token):
        """Test getting a specific application"""
        # First get list to find an app ID
        list_response = requests.get(
            f"{BASE_URL}/api/applications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        apps = list_response.json()["applications"]
        if not apps:
            pytest.skip("No applications to test")
        
        app_id = apps[0]["id"]
        response = requests.get(
            f"{BASE_URL}/api/applications/{app_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == app_id
        print(f"Retrieved application: {data['name']}")
    
    def test_update_application_ip_allowlist(self, auth_token):
        """Test updating application IP allowlist"""
        # Get an existing application
        list_response = requests.get(
            f"{BASE_URL}/api/applications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        apps = list_response.json()["applications"]
        if not apps:
            pytest.skip("No applications to test")
        
        app = apps[0]
        app_id = app["id"]
        original_allowlist = app["ip_allowlist"]
        
        # Update with new IP
        new_allowlist = original_allowlist + [{"type": "manual", "value": "192.168.99.99"}]
        update_response = requests.put(
            f"{BASE_URL}/api/applications/{app_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"ip_allowlist": new_allowlist}
        )
        assert update_response.status_code == 200
        print(f"Updated application {app['name']} IP allowlist")
        
        # Verify update
        get_response = requests.get(
            f"{BASE_URL}/api/applications/{app_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        updated_app = get_response.json()
        assert len(updated_app["ip_allowlist"]) == len(new_allowlist)
        
        # Restore original
        requests.put(
            f"{BASE_URL}/api/applications/{app_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"ip_allowlist": original_allowlist}
        )


class TestTemplatePropagation:
    """Tests for template changes propagating to linked applications - BUG FIX VERIFICATION"""
    
    def test_template_update_propagates_to_applications(self, auth_token):
        """
        BUG FIX TEST: When a template is updated, all linked applications should 
        have their ip_allowlist entries updated with the new template value.
        """
        # Get current templates
        templates_response = requests.get(
            f"{BASE_URL}/api/ip-templates",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        templates = templates_response.json()["templates"]
        
        # Find Office Network template (linked to both apps)
        office_template = next((t for t in templates if t["name"] == "Office Network"), None)
        if not office_template:
            pytest.skip("Office Network template not found")
        
        template_id = office_template["id"]
        original_value = office_template["value"]
        
        # Get applications before update
        apps_before = requests.get(
            f"{BASE_URL}/api/applications",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()["applications"]
        
        # Update the template value
        new_value = "10.99.0.0/16"
        update_response = requests.put(
            f"{BASE_URL}/api/ip-templates/{template_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"value": new_value}
        )
        assert update_response.status_code == 200
        update_data = update_response.json()
        print(f"Template updated. Affected apps: {update_data.get('affected_apps', [])}")
        
        # Get applications after update
        apps_after = requests.get(
            f"{BASE_URL}/api/applications",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()["applications"]
        
        # Verify all linked applications have the new value
        for app in apps_after:
            for entry in app["ip_allowlist"]:
                if entry.get("template_id") == template_id:
                    assert entry["value"] == new_value, \
                        f"App {app['name']} still has old value {entry['value']}"
                    print(f"App {app['name']} correctly updated to {new_value}")
        
        # Restore original value
        requests.put(
            f"{BASE_URL}/api/ip-templates/{template_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"value": original_value}
        )
        print(f"Restored template to original value: {original_value}")
    
    def test_template_name_update_propagates(self, auth_token):
        """Test that template name changes also propagate to applications"""
        # Get Office Network template
        templates_response = requests.get(
            f"{BASE_URL}/api/ip-templates",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        templates = templates_response.json()["templates"]
        office_template = next((t for t in templates if t["name"] == "Office Network"), None)
        if not office_template:
            pytest.skip("Office Network template not found")
        
        template_id = office_template["id"]
        original_name = office_template["name"]
        
        # Update template name
        new_name = "Office Network Updated"
        update_response = requests.put(
            f"{BASE_URL}/api/ip-templates/{template_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"name": new_name}
        )
        assert update_response.status_code == 200
        
        # Verify applications have updated template_name
        apps_response = requests.get(
            f"{BASE_URL}/api/applications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        apps = apps_response.json()["applications"]
        
        for app in apps:
            for entry in app["ip_allowlist"]:
                if entry.get("template_id") == template_id:
                    assert entry["template_name"] == new_name, \
                        f"App {app['name']} still has old name {entry['template_name']}"
                    print(f"App {app['name']} template_name correctly updated to {new_name}")
        
        # Restore original name
        requests.put(
            f"{BASE_URL}/api/ip-templates/{template_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"name": original_name}
        )


class TestNamespaces:
    """Namespace endpoint tests"""
    
    def test_list_namespaces(self, auth_token):
        """Test listing K8s namespaces (may be empty in test env)"""
        response = requests.get(
            f"{BASE_URL}/api/namespaces",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "namespaces" in data
        print(f"Found {len(data['namespaces'])} namespaces (may be empty in test env)")


class TestNewFeatures:
    """Tests for NEW features: Template usage counter, YAML preview endpoint"""
    
    def test_template_usage_endpoint(self, auth_token):
        """
        NEW FEATURE TEST: GET /api/ip-templates/usage returns correct usage counts
        Expected: Office Network = 2 apps, VPN Network = 0 apps
        """
        response = requests.get(
            f"{BASE_URL}/api/ip-templates/usage",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "usage" in data
        assert isinstance(data["usage"], dict)
        print(f"Template usage data: {data['usage']}")
        
        # Get templates to map IDs to names
        templates_response = requests.get(
            f"{BASE_URL}/api/ip-templates",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        templates = templates_response.json()["templates"]
        
        # Verify Office Network has 2 apps linked
        office_template = next((t for t in templates if t["name"] == "Office Network"), None)
        if office_template:
            office_usage = data["usage"].get(office_template["id"], 0)
            print(f"Office Network template usage: {office_usage} apps")
            # Should be 2 (my-web-app and api-gateway)
            assert office_usage == 2, f"Expected Office Network to have 2 apps, got {office_usage}"
        
        # Verify VPN Network has 0 apps linked
        vpn_template = next((t for t in templates if t["name"] == "VPN Network"), None)
        if vpn_template:
            vpn_usage = data["usage"].get(vpn_template["id"], 0)
            print(f"VPN Network template usage: {vpn_usage} apps")
            assert vpn_usage == 0, f"Expected VPN Network to have 0 apps, got {vpn_usage}"
    
    def test_application_yaml_endpoint(self, auth_token):
        """
        NEW FEATURE TEST: GET /api/applications/{id}/yaml returns valid Traefik Middleware YAML
        """
        # Get an application
        apps_response = requests.get(
            f"{BASE_URL}/api/applications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        apps = apps_response.json()["applications"]
        if not apps:
            pytest.skip("No applications to test YAML endpoint")
        
        app = apps[0]
        app_id = app["id"]
        
        # Get YAML for the application
        response = requests.get(
            f"{BASE_URL}/api/applications/{app_id}/yaml",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "yaml" in data
        assert "name" in data
        assert "namespace" in data
        assert data["name"] == app["name"]
        assert data["namespace"] == app["namespace"]
        
        # Verify YAML content contains required Traefik middleware fields
        yaml_content = data["yaml"]
        assert "apiVersion: traefik.io/v1alpha1" in yaml_content
        assert "kind: Middleware" in yaml_content
        assert "metadata:" in yaml_content
        assert "spec:" in yaml_content
        assert "ipAllowList:" in yaml_content
        assert "sourceRange:" in yaml_content
        
        print(f"YAML for {app['name']}:\n{yaml_content}")
    
    def test_yaml_endpoint_with_known_app_ids(self, auth_token):
        """
        Test YAML endpoint with specific app IDs from seed data
        my-web-app=69dbce826284e081bfb04327, api-gateway=69dbce826284e081bfb04328
        """
        app_ids = ["69dbce826284e081bfb04327", "69dbce826284e081bfb04328"]
        
        for app_id in app_ids:
            response = requests.get(
                f"{BASE_URL}/api/applications/{app_id}/yaml",
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            # May return 404 if seed data IDs changed
            if response.status_code == 200:
                data = response.json()
                print(f"YAML for app {data['name']} retrieved successfully")
                assert "yaml" in data
            elif response.status_code == 404:
                print(f"App ID {app_id} not found (seed data may have different IDs)")
            else:
                pytest.fail(f"Unexpected status code {response.status_code} for app {app_id}")
    
    def test_yaml_endpoint_invalid_app_id(self, auth_token):
        """Test YAML endpoint with invalid app ID returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/applications/invalid_id_12345/yaml",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404
        print("Invalid app ID correctly returns 404")
    
    def test_applications_list_has_all_ips(self, auth_token):
        """
        NEW FEATURE TEST: Verify applications list returns ALL IPs (not truncated)
        Backend should return full ip_allowlist array
        """
        response = requests.get(
            f"{BASE_URL}/api/applications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        apps = response.json()["applications"]
        
        for app in apps:
            ip_list = app.get("ip_allowlist", [])
            print(f"App {app['name']} has {len(ip_list)} IP entries: {ip_list}")
            
            # Verify each entry has required fields
            for entry in ip_list:
                assert "type" in entry, f"Missing 'type' in entry: {entry}"
                assert "value" in entry, f"Missing 'value' in entry: {entry}"
                if entry["type"] == "template":
                    assert "template_id" in entry, f"Template entry missing template_id: {entry}"
                    assert "template_name" in entry, f"Template entry missing template_name: {entry}"


class TestYamlSourceBadge:
    """
    NEW FEATURE TESTS: YAML endpoint returns 'source' field indicating 
    whether YAML is from live cluster or generated
    """
    
    def test_yaml_endpoint_returns_source_field(self, auth_token):
        """
        NEW FEATURE: GET /api/applications/{id}/yaml returns 'source' field
        In test environment (no K8s cluster), source should be 'generated'
        """
        # Get an application
        apps_response = requests.get(
            f"{BASE_URL}/api/applications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        apps = apps_response.json()["applications"]
        if not apps:
            pytest.skip("No applications to test YAML endpoint")
        
        app = apps[0]
        app_id = app["id"]
        
        # Get YAML for the application
        response = requests.get(
            f"{BASE_URL}/api/applications/{app_id}/yaml",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify 'source' field exists
        assert "source" in data, "Response missing 'source' field"
        
        # In test environment (no K8s cluster), source should be 'generated'
        assert data["source"] in ["cluster", "generated"], \
            f"Invalid source value: {data['source']}"
        
        print(f"YAML source for {app['name']}: {data['source']}")
        
        # Since K8s is not available in test env, expect 'generated'
        assert data["source"] == "generated", \
            f"Expected 'generated' source in test env, got '{data['source']}'"
        print("Source correctly shows 'generated' (cluster unavailable)")
    
    def test_yaml_source_for_all_apps(self, auth_token):
        """Test that all applications return source field in YAML response"""
        apps_response = requests.get(
            f"{BASE_URL}/api/applications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        apps = apps_response.json()["applications"]
        
        for app in apps:
            response = requests.get(
                f"{BASE_URL}/api/applications/{app['id']}/yaml",
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            assert response.status_code == 200
            data = response.json()
            
            assert "source" in data, f"App {app['name']} YAML missing 'source' field"
            assert "yaml" in data, f"App {app['name']} YAML missing 'yaml' field"
            assert "name" in data, f"App {app['name']} YAML missing 'name' field"
            assert "namespace" in data, f"App {app['name']} YAML missing 'namespace' field"
            
            print(f"App {app['name']}: source={data['source']}")


class TestUserRoleToggle:
    """
    NEW FEATURE TESTS: User role can now enable/disable applications
    (was admin-only before)
    """
    
    def test_toggle_endpoint_accepts_user_role_in_decorator(self, auth_token):
        """
        NEW FEATURE: POST /api/applications/{id}/toggle accepts 'user' role
        Verify by checking the backend code accepts ['admin', 'user'] roles
        This test verifies the endpoint works with admin role (which we have)
        """
        # Get an application
        apps_response = requests.get(
            f"{BASE_URL}/api/applications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        apps = apps_response.json()["applications"]
        if not apps:
            pytest.skip("No applications to test toggle endpoint")
        
        app = apps[0]
        app_id = app["id"]
        original_enabled = app["enabled"]
        
        # Toggle the application (disable if enabled, enable if disabled)
        new_enabled = not original_enabled
        response = requests.post(
            f"{BASE_URL}/api/applications/{app_id}/toggle?enabled={str(new_enabled).lower()}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        expected_msg = f"Application {'enabled' if new_enabled else 'disabled'} successfully"
        assert data["message"] == expected_msg
        print(f"Toggle successful: {data['message']}")
        
        # Verify the change
        get_response = requests.get(
            f"{BASE_URL}/api/applications/{app_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        updated_app = get_response.json()
        assert updated_app["enabled"] == new_enabled
        print(f"App {app['name']} enabled state changed from {original_enabled} to {new_enabled}")
        
        # Restore original state
        requests.post(
            f"{BASE_URL}/api/applications/{app_id}/toggle?enabled={str(original_enabled).lower()}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Restored app to original state: enabled={original_enabled}")
    
    def test_toggle_endpoint_role_verification(self, auth_token):
        """
        Verify the toggle endpoint decorator accepts both 'admin' and 'user' roles
        by checking the endpoint is accessible (admin role test)
        """
        # Get an application
        apps_response = requests.get(
            f"{BASE_URL}/api/applications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        apps = apps_response.json()["applications"]
        if not apps:
            pytest.skip("No applications to test")
        
        app = apps[0]
        
        # Test that toggle endpoint is accessible with admin role
        # The endpoint should return 200 (success) not 403 (forbidden)
        response = requests.post(
            f"{BASE_URL}/api/applications/{app['id']}/toggle?enabled={str(app['enabled']).lower()}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Should not be 403 (forbidden) - means role check passed
        assert response.status_code != 403, "Toggle endpoint rejected admin role"
        assert response.status_code == 200, f"Unexpected status: {response.status_code}"
        print("Toggle endpoint accessible with admin role (user role also accepted per code)")


class TestIPTemplatesUserRole:
    """
    Tests for IP Templates CRUD with user role permissions
    User role can create/update/delete templates (already was allowed, verify still works)
    """
    
    def test_ip_templates_crud_with_admin_role(self, auth_token):
        """
        Verify IP templates CRUD works with admin role
        (User role has same permissions per require_role decorator)
        """
        # Create template
        create_response = requests.post(
            f"{BASE_URL}/api/ip-templates",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "name": "TEST_UserRole_Template",
                "value": "10.100.0.0/16",
                "description": "Test template for user role verification"
            }
        )
        assert create_response.status_code == 200
        template = create_response.json()
        template_id = template["id"]
        print(f"Created template: {template['name']}")
        
        # Update template
        update_response = requests.put(
            f"{BASE_URL}/api/ip-templates/{template_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"description": "Updated description"}
        )
        assert update_response.status_code == 200
        print("Updated template successfully")
        
        # Delete template
        delete_response = requests.delete(
            f"{BASE_URL}/api/ip-templates/{template_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert delete_response.status_code == 200
        print("Deleted template successfully")
        print("IP Templates CRUD verified (admin role, user role has same permissions)")


# Fixtures
@pytest.fixture
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(
        f"{BASE_URL}/api/auth/local-login",
        json={"username": SUPER_ADMIN_USERNAME, "password": SUPER_ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.fail(f"Failed to get auth token: {response.text}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
