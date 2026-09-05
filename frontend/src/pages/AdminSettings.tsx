import { useState } from 'react';
import { Save, Shield, Database, Cpu, Globe, Bell, Key } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Alert } from '../components/UI';
import toast from 'react-hot-toast';

export function AdminSettings() {
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'security' | 'storage' | 'notifications'>('general');

  const settings = {
    general: {
      appName: 'Label Compliance Checker',
      appEnv: 'development',
      debugMode: true,
      maintenanceMode: false,
      defaultPageSize: 20,
      maxFileSize: 20,
      allowedExtensions: 'png,jpg,jpeg,pdf,webp,bmp',
    },
    security: {
      jwtExpiry: 720,
      refreshExpiry: 168,
      bcryptRounds: 12,
      rateLimitUpload: 60,
      rateLimitApi: 120,
      sessionTimeout: 30,
    },
    storage: {
      backend: 'local',
      localPath: './uploads',
      s3Bucket: '',
      s3Region: 'ap-south-1',
      s3AccessKey: '',
      s3SecretKey: '',
    },
    notifications: {
      emailEnabled: false,
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      smtpPass: '',
      fromEmail: 'noreply@labelcheck.local',
    },
  };

  const handleSave = async (section: string) => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 500));
    toast.success(`${section} settings saved`);
    setSaving(false);
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'storage', label: 'Storage', icon: Database },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-500">Configure application settings and preferences</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <Card className="lg:w-64 flex-shrink-0">
          <CardContent className="p-2">
            <nav className="space-y-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </CardContent>
        </Card>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'general' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  General Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Application Name" value={settings.general.appName} onChange={e => settings.general.appName = e.target.value} />
                  <select className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" value={settings.general.appEnv} onChange={e => settings.general.appEnv = e.target.value}>
                    <option value="development">Development</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                  </select>
                  <Input label="Default Page Size" type="number" value={settings.general.defaultPageSize} onChange={e => settings.general.defaultPageSize = Number(e.target.value)} />
                  <Input label="Max File Size (MB)" type="number" value={settings.general.maxFileSize} onChange={e => settings.general.maxFileSize = Number(e.target.value)} />
                </div>
                <Input label="Allowed Extensions (comma-separated)" value={settings.general.allowedExtensions} onChange={e => settings.general.allowedExtensions = e.target.value} />
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={settings.general.debugMode} onChange={e => settings.general.debugMode = e.target.checked} className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                    <span className="text-sm text-gray-700">Debug Mode</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={settings.general.maintenanceMode} onChange={e => settings.general.maintenanceMode = e.target.checked} className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                    <span className="text-sm text-gray-700">Maintenance Mode</span>
                  </label>
                </div>
                <Button onClick={() => handleSave('General')} loading={saving}>
                  <Save className="w-4 h-4 mr-1" /> Save General Settings
                </Button>
              </CardContent>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="JWT Expiry (minutes)" type="number" value={settings.security.jwtExpiry} onChange={e => settings.security.jwtExpiry = Number(e.target.value)} />
                  <Input label="Refresh Token Expiry (hours)" type="number" value={settings.security.refreshExpiry} onChange={e => settings.security.refreshExpiry = Number(e.target.value)} />
                  <Input label="BCrypt Rounds" type="number" value={settings.security.bcryptRounds} onChange={e => settings.security.bcryptRounds = Number(e.target.value)} />
                  <Input label="Session Timeout (minutes)" type="number" value={settings.security.sessionTimeout} onChange={e => settings.security.sessionTimeout = Number(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Upload Rate Limit (req/min)" type="number" value={settings.security.rateLimitUpload} onChange={e => settings.security.rateLimitUpload = Number(e.target.value)} />
                  <Input label="API Rate Limit (req/min)" type="number" value={settings.security.rateLimitApi} onChange={e => settings.security.rateLimitApi = Number(e.target.value)} />
                </div>
                <Alert variant="info" className="flex items-start gap-3">
                  <Key className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Security Notes</p>
                    <p className="text-sm mt-1">Changes to JWT expiry and bcrypt rounds require application restart. Rate limits are enforced per IP address.</p>
                  </div>
                </Alert>
                <Button onClick={() => handleSave('Security')} loading={saving}>
                  <Save className="w-4 h-4 mr-1" /> Save Security Settings
                </Button>
              </CardContent>
            </Card>
          )}

          {activeTab === 'storage' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Storage Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Storage Backend</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="storage" value="local" checked={settings.storage.backend === 'local'} onChange={() => settings.storage.backend = 'local'} className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500" />
                      <span className="text-sm text-gray-700">Local Filesystem</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="storage" value="s3" checked={settings.storage.backend === 's3'} onChange={() => settings.storage.backend = 's3'} className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500" />
                      <span className="text-sm text-gray-700">S3 Compatible</span>
                    </label>
                  </div>
                </div>

                {settings.storage.backend === 'local' && (
                  <Input label="Local Upload Path" value={settings.storage.localPath} onChange={e => settings.storage.localPath = e.target.value} />
                )}

                {settings.storage.backend === 's3' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="S3 Bucket" value={settings.storage.s3Bucket} onChange={e => settings.storage.s3Bucket = e.target.value} />
                    <Input label="S3 Region" value={settings.storage.s3Region} onChange={e => settings.storage.s3Region = e.target.value} />
                    <Input label="Access Key ID" type="password" value={settings.storage.s3AccessKey} onChange={e => settings.storage.s3AccessKey = e.target.value} />
                    <Input label="Secret Access Key" type="password" value={settings.storage.s3SecretKey} onChange={e => settings.storage.s3SecretKey = e.target.value} />
                  </div>
                )}

                <Alert variant="info" className="flex items-start gap-3">
                  <Cpu className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Storage Notes</p>
                    <p className="text-sm mt-1">Changing storage backend requires application restart. Ensure proper permissions for local path or valid S3 credentials.</p>
                  </div>
                </Alert>
                <Button onClick={() => handleSave('Storage')} loading={saving}>
                  <Save className="w-4 h-4 mr-1" /> Save Storage Settings
                </Button>
              </CardContent>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Notification Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={settings.notifications.emailEnabled} onChange={e => settings.notifications.emailEnabled = e.target.checked} className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                    <span className="text-sm text-gray-700">Enable Email Notifications</span>
                  </label>
                </div>
                {settings.notifications.emailEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="SMTP Host" value={settings.notifications.smtpHost} onChange={e => settings.notifications.smtpHost = e.target.value} />
                    <Input label="SMTP Port" type="number" value={settings.notifications.smtpPort} onChange={e => settings.notifications.smtpPort = Number(e.target.value)} />
                    <Input label="SMTP Username" value={settings.notifications.smtpUser} onChange={e => settings.notifications.smtpUser = e.target.value} />
                    <Input label="SMTP Password" type="password" value={settings.notifications.smtpPass} onChange={e => settings.notifications.smtpPass = e.target.value} />
                    <Input label="From Email" value={settings.notifications.fromEmail} onChange={e => settings.notifications.fromEmail = e.target.value} />
                  </div>
                )}
                <Button onClick={() => handleSave('Notifications')} loading={saving} disabled={!settings.notifications.emailEnabled}>
                  <Save className="w-4 h-4 mr-1" /> Save Notification Settings
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}