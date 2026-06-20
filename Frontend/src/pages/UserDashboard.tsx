import Footer from "../components/Footer";
import UserNavBar from "../components/UserStuff/UserNavBar";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import MainPage from "../components/UserStuff/Mainpage";
import { supabase } from "../config/supabaseClient";

interface UserCharacterSelectionProps {
  chatList: { name: string; image: string; details: string }[];
  handleDelete: (buttonName: string) => void;
  addChat: (
    characterName: string,
    characterImage: string,
    characterDetails: string
  ) => void;
  setUser: React.Dispatch<
    React.SetStateAction<{
      username: string;
      userId: string | number;
    }>
  >;
  user: { username: string; userId: string | number };
}


const UserCharacterSelection = ({
  chatList,
  handleDelete,
  addChat,
  setUser,
  user,
}: UserCharacterSelectionProps) => {

  const navigate = useNavigate();

  // Check user session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/Login");
          return;
        }

        // Fetch user profile data from public.users table
        const { data: profile, error: profileError } = await supabase
          .from("users")
          .select("username, user_id, role")
          .eq("user_id", session.user.id)
          .single();

        if (profileError || !profile) {
          console.error("Profile not found:", profileError);
          navigate("/Login");
          return;
        }

        // Check if user has the "user" role (or other allowed roles)
        if (profile.role !== "user" && profile.role !== "admin" && profile.role !== "moderator") {
          navigate("/Login");
          return;
        }

        setUser({
          username: profile.username,
          userId: profile.user_id,
        });
        navigate("/chat");

      } catch (err) {
        console.error("Error checking session:", err);
        navigate("/Login");
      }
    };

    checkSession();
  }, [navigate, setUser]);


  return (
    <div className="bg-[#05070d] flex h-screen w-screen items-center justify-center text-cyan-500 font-mono text-sm">
      <div className="flex flex-col items-center space-y-4">
        <div className="h-6 w-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="tracking-widest">VERIFYING OPERATOR ACCESS...</span>
      </div>
    </div>
  );
};

// Update MainPageProps to use lowercase prop names for consistency

export default UserCharacterSelection;
