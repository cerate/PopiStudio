import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { i18nService } from '../../services/i18n';
import { setIsShowLoginModal, setLoggedIn } from '@/store/slices/authSlice';
import { clearServerModels } from '@/store/slices/modelSlice';
import Modal from '../common/Modal';

const SMS_LOGIN_BASE_URL = 'https://popi.yuanzoo.cn';

type LoginTab = 'sms' | 'password';

const LoginView: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState<LoginTab>('sms');
  const [loading, setLoading] = useState(false);
  const [verificationView, setVerificationView] = useState(false);
  const [captchaId, setCaptchaId] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [captchaValue, setCaptchaValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [smsForm, setSmsForm] = useState({
    phone: '',
    code: '',
    inviteCode: '',
  });
  
  const [passwordForm, setPasswordForm] = useState({
    username: '',
    password: '',
  });

  const [countdown, setCountdown] = useState(0);

  const fetchCaptcha = async () => {
    setError(null);
    try {
      const response = await window.electron.api.fetch({
        url: `${SMS_LOGIN_BASE_URL}/api_client/captcha/gen`,
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });    
      if (response.ok && response?.status === 200) {
        setCaptchaId(response.data.data.id);
        setCaptchaImage(response.data.data.data);
        setVerificationView(true);
      } else {
        setError(response.data?.message || '获取验证码失败');
      }
    } catch (err) {
      setError('获取验证码失败，请稍后重试');
    }
  };

  const handleSendCode = async () => {
    if (!smsForm.phone || smsForm.phone.length !== 11) {
      setError('请输入正确的手机号');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await window.electron.api.fetch({
        url: `${SMS_LOGIN_BASE_URL}/api_client/auth/code?phone=${smsForm.phone}&usage=LOGIN&captchaId=${captchaId}&captchaValue=${captchaValue}`,
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok && response?.status === 200) {
        setCountdown(60);
        setVerificationView(false);
        setCaptchaValue('');
        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setError(response.data?.message || '发送失败');
        await fetchCaptcha();
      }
    } catch (err) {
      setError('发送失败，请稍后重试');
      await fetchCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleSmsLogin = async () => {
    if (!smsForm.phone || !smsForm.code) {
      setError('请输入手机号和验证码');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await window.electron.api.fetch({
        url: `${SMS_LOGIN_BASE_URL}/api_client/auth/loginByCode`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: smsForm.phone,
          code: smsForm.code,
          inviteCode: smsForm.inviteCode,
        }),
      });

      if (response.ok && response?.status === 200) {
        const responseData = response.data.data;
        const _token = responseData.token;
        const userData = responseData.user;
        const user = {
          id: userData.id,
          yid: String(userData.id),
          nickname: userData.name || userData.code || '用户',
          avatarUrl: userData.avatar || null,
          phone: userData.phone || null,
        };
        const quota = {
          planName: userData.isMember ? 'VIP' : '免费',
          subscriptionStatus: userData.isMember ? 'active' : 'free',
          creditsLimit: userData.memberCoins + userData.otherCoins,
          creditsUsed: 0,
          creditsRemaining: userData.memberCoins + userData.otherCoins,
        };
        // window.electron.auth.saveToken?.(token);
        dispatch(setLoggedIn({ user, quota }));
        dispatch(clearServerModels());
        onClose();
        setSmsForm({ phone: '', code: '', inviteCode: '' });
      } else {
        setError(response.data?.message || '登录失败');
      }
    } catch (err) {
      setError('登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    if (!passwordForm.username || !passwordForm.password) {
      setError('请输入用户名和密码');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await window.electron.api.fetch({
        url: `${SMS_LOGIN_BASE_URL}/api_client/auth/login`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: passwordForm.username,
          password: passwordForm.password,
        }),
      });  
      if (response.ok && response?.status === 200) {
        const responseData = response.data.data;
        const _token = responseData.token;
        const userData = responseData.user;
        const user = {
          id: userData.id,
          yid: String(userData.id),
          nickname: userData.name || userData.code || '用户',
          avatarUrl: userData.avatar || null,
          phone: userData.phone || null,
        };
        const quota = {
          planName: userData.isMember ? 'VIP' : '免费',
          subscriptionStatus: userData.isMember ? 'active' : 'free',
          creditsLimit: userData.allCoins,
          creditsUsed: 0,
          creditsRemaining: userData.allCoins,
        };
        // window.electron.auth.saveToken?.(token);
        dispatch(setLoggedIn({ user, quota }));
        dispatch(clearServerModels());
        onClose();
        setPasswordForm({ username: '', password: '' });
      } else {
        setError(response.data?.message || '登录失败');
      }
    } catch (err) {
      setError('登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setSmsForm({ phone: '', code: '', inviteCode: '' });
    setPasswordForm({ username: '', password: '' });
    dispatch(setIsShowLoginModal(false));
  };

  return (
    <>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">{i18nService.t('login')}</h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-secondary hover:text-foreground transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex border-b border-border mb-4">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setActiveTab('sms');
            }}
            className={`flex-1 pb-2 text-sm font-medium transition-colors ${
              activeTab === 'sms'
                ? 'text-primary border-b-2 border-primary'
                : 'text-secondary hover:text-foreground'
            }`}
          >
            短信登录
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setActiveTab('password');
            }}
            className={`flex-1 pb-2 text-sm font-medium transition-colors ${
              activeTab === 'password'
                ? 'text-primary border-b-2 border-primary'
                : 'text-secondary hover:text-foreground'
            }`}
          >
            账号登录
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {activeTab === 'sms' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">手机号</label>
              <input
                type="tel"
                value={smsForm.phone}
                onChange={e =>
                  setSmsForm({ ...smsForm, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })
                }
                placeholder="请输入手机号"
                className="w-full px-3 py-2 bg-surface-raised border border-border rounded-lg text-sm text-foreground placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">验证码</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={smsForm.code}
                  onChange={e =>
                    setSmsForm({ ...smsForm, code: e.target.value.replace(/\D/g, '').slice(0, 6) })
                  }
                  placeholder="请输入验证码"
                  className="flex-1 px-3 py-2 bg-surface-raised border border-border rounded-lg text-sm text-foreground placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  type="button"
                  onClick={async () => {
                    setVerificationView(true)
                     await fetchCaptcha();
                  }}
                  disabled={countdown > 0 || !smsForm.phone || smsForm.phone.length !== 11}
                  className="px-3 py-2 bg-surface-raised border border-border rounded-lg text-sm text-primary hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {countdown > 0 ? `${countdown}s` : '获取验证码'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                邀请码 <span className="text-secondary font-normal">(可选)</span>
              </label>
              <input
                type="text"
                value={smsForm.inviteCode}
                onChange={e => setSmsForm({ ...smsForm, inviteCode: e.target.value })}
                placeholder="请输入邀请码"
                className="w-full px-3 py-2 bg-surface-raised border border-border rounded-lg text-sm text-foreground placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <button
              type="button"
              onClick={handleSmsLogin}
              disabled={loading || !smsForm.phone || !smsForm.code}
              className="w-full py-2.5 bg-primary text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                用户名 / 邮箱
              </label>
              <input
                type="text"
                value={passwordForm.username}
                onChange={e => setPasswordForm({ ...passwordForm, username: e.target.value })}
                placeholder="请输入用户名或邮箱"
                className="w-full px-3 py-2 bg-surface-raised border border-border rounded-lg text-sm text-foreground placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">密码</label>
              <input
                type="password"
                value={passwordForm.password}
                onChange={e => setPasswordForm({ ...passwordForm, password: e.target.value })}
                placeholder="请输入密码"
                className="w-full px-3 py-2 bg-surface-raised border border-border rounded-lg text-sm text-foreground placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <button
              type="button"
              onClick={handlePasswordLogin}
              disabled={loading || !passwordForm.username || !passwordForm.password}
              className="w-full py-2.5 bg-primary text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </div>
        )}
      </div>
      {verificationView && (
        <Modal
          onClose={() => setVerificationView(false)}
          className="w-[400px] bg-surface rounded-xl shadow-popover border border-border overflow-hidden p-6"
        >
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">请输入图像验证码</h2>
            </div>
            <div className="flex flex-col items-center justify-center px-4 gap-4">
              {captchaImage && (
                <img 
                  src={captchaImage} 
                  alt="验证码" 
                  className="w-full h-24 object-contain bg-white rounded cursor-pointer"
                  onClick={fetchCaptcha}
                />
              )}
              <input
                type="text"
                value={captchaValue}
                onChange={e => setCaptchaValue(e.target.value)}
                placeholder="请输入图像验证码"
                className="w-full px-3 py-2 bg-surface-raised border border-border rounded-lg text-sm text-foreground placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <div className="flex justify-between w-full gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCaptchaValue('');
                    setVerificationView(false);
                  }}
                  className="w-full py-2.5 bg-surface text-foreground rounded-lg font-medium hover:bg-surface-raised transition-opacity border border-border"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (captchaValue) {
                      setVerificationView(false);
                      handleSendCode();
                    }
                  }}
                  disabled={!captchaValue}
                  className="w-full py-2.5 bg-primary text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity border border-border"
                >
                  确认
                </button>
              </div>
            </div>
          </>
        </Modal>
      )}
    </>
  );
};

export default LoginView;
