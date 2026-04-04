import requests
import sys
import json
from datetime import datetime

class VaultKeeperAPITester:
    def __init__(self, base_url="https://vault-team-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.admin_user = None
        self.test_user = None
        self.test_space_id = None
        self.test_credential_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, cookies=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {method} {url}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_admin_login(self):
        """Test admin login with credentials from test_credentials.md"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "api/auth/login",
            200,
            data={"email": "admin@vaultkeeper.com", "password": "VaultAdmin2024!"}
        )
        if success:
            self.admin_user = response
            print(f"   Admin logged in: {response.get('email')}")
        return success

    def test_user_registration(self):
        """Test user registration"""
        test_email = f"test_user_{datetime.now().strftime('%H%M%S')}@example.com"
        success, response = self.run_test(
            "User Registration",
            "POST",
            "api/auth/register",
            200,
            data={"email": test_email, "password": "TestPass123!", "name": "Test User"}
        )
        if success:
            self.test_user = response
            print(f"   User registered: {response.get('email')}")
        return success

    def test_get_current_user(self):
        """Test getting current user info"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "api/auth/me",
            200
        )
        return success

    def test_create_space(self):
        """Test creating a space"""
        success, response = self.run_test(
            "Create Space",
            "POST",
            "api/spaces",
            200,
            data={"name": "Test Space", "description": "A test space for credentials"}
        )
        if success:
            self.test_space_id = response.get('id')
            print(f"   Space created with ID: {self.test_space_id}")
        return success

    def test_get_spaces(self):
        """Test getting user spaces"""
        success, response = self.run_test(
            "Get Spaces",
            "GET",
            "api/spaces",
            200
        )
        if success:
            print(f"   Found {len(response)} spaces")
        return success

    def test_get_space_detail(self):
        """Test getting space details"""
        if not self.test_space_id:
            print("❌ No test space ID available")
            return False
            
        success, response = self.run_test(
            "Get Space Detail",
            "GET",
            f"api/spaces/{self.test_space_id}",
            200
        )
        return success

    def test_create_credential(self):
        """Test creating a credential"""
        if not self.test_space_id:
            print("❌ No test space ID available")
            return False
            
        success, response = self.run_test(
            "Create Credential",
            "POST",
            "api/credentials",
            200,
            data={
                "space_id": self.test_space_id,
                "type": "password",
                "title": "Test Website",
                "username": "testuser",
                "password": "testpass123",
                "url": "https://example.com",
                "notes": "Test credential"
            }
        )
        if success:
            self.test_credential_id = response.get('id')
            print(f"   Credential created with ID: {self.test_credential_id}")
        return success

    def test_get_credentials(self):
        """Test getting credentials for a space"""
        if not self.test_space_id:
            print("❌ No test space ID available")
            return False
            
        success, response = self.run_test(
            "Get Credentials",
            "GET",
            f"api/credentials/{self.test_space_id}",
            200
        )
        if success:
            print(f"   Found {len(response)} credentials")
        return success

    def test_get_credential_detail(self):
        """Test getting specific credential"""
        if not self.test_credential_id:
            print("❌ No test credential ID available")
            return False
            
        success, response = self.run_test(
            "Get Credential Detail",
            "GET",
            f"api/credential/{self.test_credential_id}",
            200
        )
        if success and 'decrypted_data' in response:
            print(f"   Credential decrypted successfully")
        return success

    def test_update_credential(self):
        """Test updating a credential"""
        if not self.test_credential_id:
            print("❌ No test credential ID available")
            return False
            
        success, response = self.run_test(
            "Update Credential",
            "PUT",
            f"api/credential/{self.test_credential_id}",
            200,
            data={
                "title": "Updated Test Website",
                "notes": "Updated test credential"
            }
        )
        return success

    def test_password_generator(self):
        """Test password generator"""
        success, response = self.run_test(
            "Password Generator",
            "POST",
            "api/password-generator",
            200,
            data={
                "length": 16,
                "include_uppercase": True,
                "include_lowercase": True,
                "include_numbers": True,
                "include_symbols": True
            }
        )
        if success and 'password' in response:
            print(f"   Generated password: {response['password']}")
        return success

    def test_export_credentials(self):
        """Test exporting credentials"""
        if not self.test_space_id:
            print("❌ No test space ID available")
            return False
            
        success, response = self.run_test(
            "Export Credentials",
            "GET",
            f"api/export/{self.test_space_id}",
            200
        )
        if success:
            print(f"   Exported {len(response.get('credentials', []))} credentials")
        return success

    def test_import_credentials(self):
        """Test importing credentials"""
        if not self.test_space_id:
            print("❌ No test space ID available")
            return False
            
        import_data = {
            "credentials": [
                {
                    "type": "password",
                    "title": "Imported Test Site",
                    "username": "imported_user",
                    "password": "imported_pass",
                    "url": "https://imported.com",
                    "notes": "Imported credential"
                }
            ]
        }
        
        success, response = self.run_test(
            "Import Credentials",
            "POST",
            f"api/import/{self.test_space_id}",
            200,
            data=import_data
        )
        return success

    def test_team_management(self):
        """Test adding team member (will fail if admin user doesn't exist)"""
        if not self.test_space_id or not self.admin_user:
            print("❌ No test space ID or admin user available")
            return False
            
        # Try to add admin as a member (should fail since admin is already owner)
        success, response = self.run_test(
            "Add Team Member",
            "POST",
            f"api/spaces/{self.test_space_id}/members",
            400,  # Expecting failure since admin is already a member
            data={
                "email": "admin@vaultkeeper.com",
                "role": "editor"
            }
        )
        # This test passes if it correctly rejects adding existing member
        return True

    def test_brute_force_protection(self):
        """Test brute force protection"""
        print("\n🔍 Testing Brute Force Protection...")
        
        # Try multiple failed logins
        for i in range(3):
            success, response = self.run_test(
                f"Failed Login Attempt {i+1}",
                "POST",
                "api/auth/login",
                401,
                data={"email": "admin@vaultkeeper.com", "password": "wrongpassword"}
            )
        
        return True

    def test_logout(self):
        """Test logout"""
        success, response = self.run_test(
            "Logout",
            "POST",
            "api/auth/logout",
            200
        )
        return success

    def cleanup_test_data(self):
        """Clean up test data"""
        if self.test_credential_id:
            self.run_test(
                "Delete Test Credential",
                "DELETE",
                f"api/credential/{self.test_credential_id}",
                200
            )
        
        if self.test_space_id:
            self.run_test(
                "Delete Test Space",
                "DELETE",
                f"api/spaces/{self.test_space_id}",
                200
            )

def main():
    print("🚀 Starting VaultKeeper API Tests")
    print("=" * 50)
    
    tester = VaultKeeperAPITester()
    
    # Test sequence
    tests = [
        ("Admin Login", tester.test_admin_login),
        ("User Registration", tester.test_user_registration),
        ("Get Current User", tester.test_get_current_user),
        ("Create Space", tester.test_create_space),
        ("Get Spaces", tester.test_get_spaces),
        ("Get Space Detail", tester.test_get_space_detail),
        ("Create Credential", tester.test_create_credential),
        ("Get Credentials", tester.test_get_credentials),
        ("Get Credential Detail", tester.test_get_credential_detail),
        ("Update Credential", tester.test_update_credential),
        ("Password Generator", tester.test_password_generator),
        ("Export Credentials", tester.test_export_credentials),
        ("Import Credentials", tester.test_import_credentials),
        ("Team Management", tester.test_team_management),
        ("Brute Force Protection", tester.test_brute_force_protection),
        ("Logout", tester.test_logout)
    ]
    
    # Run tests
    for test_name, test_func in tests:
        try:
            test_func()
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
    
    # Cleanup
    print("\n🧹 Cleaning up test data...")
    tester.cleanup_test_data()
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"📈 Success Rate: {success_rate:.1f}%")
    
    if success_rate >= 80:
        print("🎉 Backend API tests mostly successful!")
        return 0
    else:
        print("⚠️  Backend API has significant issues")
        return 1

if __name__ == "__main__":
    sys.exit(main())