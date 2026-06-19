import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar";
import CharactersBarGraph from "../components/AdminDashboardComponents/CategoriesBarGraph";
import { supabase } from "../config/supabaseClient";

function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/Login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("users")
          .select("username, role")
          .eq("user_id", session.user.id)
          .single();

        if (profileError || !profile || profile.role !== "admin") {
          console.error("Not an admin:", profileError);
          navigate("/Login");
          return;
        }

        setUsername(profile.username);
        setLoading(false);
      } catch (error) {
        console.error("Error checking admin status:", error);
        navigate("/Login");
      }
    };

    checkAdmin();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#212121] text-white">
        <p>Loading admin panel...</p>
      </div>
    );
  }

  return (
    <div>
      <NavBar admin={true} logged={username} />
      <div className="w-[800px] h-full md:min-w-[100%] lg:min-w-[100%] flex flex-col items-center mt-20">
        <CharactersBarGraph />
      </div>
    </div>
  );
}

export default AdminDashboard;