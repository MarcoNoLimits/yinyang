import React, { useState, useEffect } from 'react';
import { FiMail, FiLock, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
import { supabase } from '../config/supabaseClient';
import { useNavigate } from 'react-router-dom';

const ResetPassword: React.FC = () => {
    const [email, setEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [step, setStep] = useState(1); // 1: request link, 3: enter new password
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // Listen to password recovery events from Supabase URL redirect
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setStep(3);
                setMessage('Verification successful. Please enter your new password below.');
                setIsError(false);
            }
        });

        // Fallback: Check if the current URL points to a recovery type
        if (window.location.hash.includes('type=recovery')) {
            setStep(3);
        }

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setIsError(false);
        
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/ResetPassword`,
            });
            if (error) throw error;
            setMessage('A password reset link has been sent to your email.');
            setIsError(false);
        } catch (error: any) {
            setMessage(error.message || 'Error sending password reset link. Please try again.');
            setIsError(true);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (newPassword !== confirmPassword) {
            setMessage('Passwords do not match');
            setIsError(true);
            return;
        }
        
        if (newPassword.length < 8) {
            setMessage('Password must be at least 8 characters long');
            setIsError(true);
            return;
        }
        
        setLoading(true);
        setIsError(false);
        
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });
            if (error) throw error;
            
            setMessage('Password reset successful! Redirecting to login...');
            setIsError(false);
            
            setTimeout(() => {
                navigate('/Login');
            }, 3000);
            
        } catch (error: any) {
            setMessage(error.message || 'Error resetting password. The link may have expired.');
            setIsError(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900">
            <div className="w-full max-w-md p-8 bg-gray-800 rounded-xl shadow-2xl transition-all duration-300 transform hover:shadow-xl">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-100 mb-2">Reset Password</h2>
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-1 bg-blue-600 rounded"></div>
                    </div>
                    <p className="text-gray-400">Follow the steps to reset your password</p>
                </div>

                {/* Progress Indicator */}
                <div className="flex items-center justify-between mb-8 px-4">
                    <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 flex items-center justify-center rounded-full ${
                            step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                        } transition-colors duration-300`}>
                            <FiMail size={18} />
                        </div>
                        <span className="text-xs mt-1 text-gray-300">Request</span>
                    </div>
                    <div className={`flex-1 h-1 ${step >= 3 ? 'bg-blue-600' : 'bg-gray-700'} transition-colors duration-300`}></div>
                    <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 flex items-center justify-center rounded-full ${
                            step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                        } transition-colors duration-300`}>
                            <FiLock size={18} />
                        </div>
                        <span className="text-xs mt-1 text-gray-300">Reset</span>
                    </div>
                </div>

                {/* Message Section */}
                {message && (
                    <div className={`mb-6 p-3 rounded-lg flex items-center ${
                        isError ? 'bg-red-900/30 text-red-300' : 'bg-green-900/30 text-green-300'
                    }`}>
                        {isError ? (
                            <FiAlertTriangle className="mr-2 flex-shrink-0" />
                        ) : (
                            <FiCheckCircle className="mr-2 flex-shrink-0" />
                        )}
                        <p className="text-sm">{message}</p>
                    </div>
                )}

                {/* Step 1: Request Link Form */}
                {step === 1 && (
                    <form onSubmit={handleSendCode} className="space-y-6">
                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Email Address
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <FiMail className="text-gray-400" />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 bg-gray-700 border border-gray-600 focus:ring-blue-500 focus:border-blue-500 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none"
                                    placeholder="Enter your email"
                                    required
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3 rounded-lg text-white font-medium 
                            ${loading ? 'bg-gray-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} 
                            transition-colors duration-300 flex justify-center`}
                        >
                            {loading ? 'Sending...' : 'Send Reset Link'}
                        </button>
                    </form>
                )}

                {/* Step 3: New Password Form */}
                {step === 3 && (
                    <form onSubmit={handleResetPassword} className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    New Password
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <FiLock className="text-gray-400" />
                                    </div>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full pl-10 pr-3 py-2 bg-gray-700 border border-gray-600 focus:ring-blue-500 focus:border-blue-500 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none"
                                        placeholder="Minimum 8 characters"
                                        required
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Confirm New Password
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <FiLock className="text-gray-400" />
                                    </div>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full pl-10 pr-3 py-2 bg-gray-700 border border-gray-600 focus:ring-blue-500 focus:border-blue-500 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none"
                                        placeholder="Re-enter password"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3 rounded-lg text-white font-medium 
                            ${loading ? 'bg-gray-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} 
                            transition-colors duration-300 flex justify-center`}
                        >
                            {loading ? 'Resetting...' : 'Update Password'}
                        </button>
                    </form>
                )}

                <div className="text-center mt-6">
                    <span 
                        onClick={() => navigate('/Login')}
                        className="text-sm text-blue-500 hover:underline cursor-pointer"
                    >
                        Back to Login
                    </span>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;