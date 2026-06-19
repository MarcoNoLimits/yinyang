import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import LoginNav from "../components/LoginNav";
import { supabase } from "../config/supabaseClient";

function SignupPage() {
  // Regular expression for validating email format.
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  // Regular expression that requires at least one uppercase letter and one special character.
  const passwordStrengthRegex = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).+$/;

  const [formData, setFormData] = useState({
    firstName: "",
    surname: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Handle input change events.
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Handle form submission.
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Check for a proper email.
    if (!emailRegex.test(formData.email)) {
      setError("Invalid email address");
      return;
    }

    // Check if passwords match.
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    // Check password strength: must contain at least one uppercase letter and one special character.
    if (!passwordStrengthRegex.test(formData.password)) {
      setError("Password must include at least one uppercase letter and one special character");
      return;
    }

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            surname: formData.surname,
            username: formData.username,
            role: "user",
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
      } else {
        setError("User registered successfully!");
        navigate("/login");
      }
    } catch (err: any) {
      setError("Failed to connect to Supabase");
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-[#212121] relative">
      <LoginNav username={null} />
      {/* GIF Background Card */}
      <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[900px] h-[450px] rounded-[30px] shadow-2xl overflow-hidden">
        <img
          src="https://media.giphy.com/media/wM2jsoKbVTur6/giphy.gif"
          alt="GIF Animation"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Sign Up Card */}
      <div className="absolute bg-[#121212] p-8 rounded-2xl shadow-lg text-white w-[350px]">
        <h2 className="text-2xl font-bold text-center">Create an Account</h2>
        <p className="text-gray-400 text-sm mt-2 text-center">
          Sign up in just a few seconds
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <input
            type="text"
            name="firstName"
            placeholder="First Name"
            value={formData.firstName}
            onChange={handleChange}
            required
            className="w-full p-2 bg-gray-900 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-white"
          />
          <input
            type="text"
            name="surname"
            placeholder="Surname"
            value={formData.surname}
            onChange={handleChange}
            required
            className="w-full p-2 bg-gray-900 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-white"
          />
          <input
            type="text"
            name="username"
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
            required
            className="w-full p-2 bg-gray-900 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-white"
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full p-2 bg-gray-900 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-white"
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
            className="w-full p-2 bg-gray-900 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-white"
          />
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            className="w-full p-2 bg-gray-900 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-white"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-white text-black p-2 rounded-md shadow"
          >
            Sign Up
          </button>
        </form>

        <p className="text-xs text-gray-500 mt-4 text-center">
          By signing up, you agree with the{" "}
          <a href="/TermsOfService" className="underline">
            Terms
          </a>{" "}
          and{" "}
          <a href="/PrivacyPolicy" className="underline">
            Privacy Policy
          </a>
        </p>

        <p className="text-sm text-gray-400 mt-4 text-center">
          Already have an account?{" "}
          <span
            className="text-blue-400 cursor-pointer hover:underline"
            onClick={() => navigate("/login")}
          >
            Log in
          </span>
        </p>
      </div>
    </div>
  );
}

export default SignupPage;
