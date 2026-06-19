import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Footer from "../Footer";
import UserNavBar from "./UserNavBar";
import { UserNavBarProps } from "./UserNavBar";
import { supabase } from "../../config/supabaseClient";
import { useEffect, useState } from "react";

interface FilterPageProps {
  chatList: { name: string; image: string; details: string }[];
  handleDelete?: (buttonName: string) => void;
}

const FilterPage: React.FC<FilterPageProps> = ({ chatList }) => {
  const [categories, setCategories] = useState<any[]>([]);
  const [username, setUsername] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkUserAndFetchCategories = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/Login");
          return;
        }

        const authUser = session.user;
        const role = authUser.user_metadata?.role || "user";
        if (role !== "user") {
          navigate("/Login");
          return;
        }

        setUsername(authUser.user_metadata?.username || authUser.email || "User");

        const { data, error } = await supabase
          .from("characters")
          .select("char_personality, char_img");
        if (error) throw error;

        if (data) {
          const unique: any[] = [];
          const seen = new Set();
          for (const item of data) {
            if (!seen.has(item.char_personality)) {
              seen.add(item.char_personality);
              unique.push(item);
            }
          }

          const withColours = unique.map((item: any) => ({
            title: item.char_personality,
            icon: item.char_img,
            color: getRandomColor(),
          }));
          setCategories(withColours);
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
      } finally {
        setLoading(false);
      }
    };

    checkUserAndFetchCategories();
  }, []);

  if (loading) {
    return (
      <div className="bg-[#212121] min-h-screen flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="bg-[#212121] min-h-screen pt-5 px-4 sm:px-6 md:px-10 lg:px-40">
      <UserNavBar
        chatList={chatList}
        username={username}
      />
      <div className="w-auto mx-auto pl-20 pr-20 pb-20 mt-10">
        <div className="flex justify-center align-start relative">
          <ArrowLeft
            className="absolute left-0 top-1/2 transform -translate-y-1/2 text-white cursor-pointer"
            onClick={() => navigate(-1)}
          />

          <p className="text-2xl sm:text-3xl text-white pb-4 sm:pb-5 sm:pt-8 text-center">
            Filters
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {categories.map((category) => (
            <FilterCards
              key={category.title} 
              icon={category.icon}
              title={category.title}
              bgColor={category.color}
            />
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
};

const FilterCards = ({
  icon,
  title,
  bgColor,
}: {
  icon: string;
  title: string;
  bgColor: string;
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    // Navigate to the new page and pass data via state
    navigate("/UserDashBoard/FilterPage/FilterList", {
      state: { icon, title, bgColor },
    });
  };
  return (
    <div className="w-full ">
      <div
        className={`w-full h-20 md:h-28  text-left rounded-lg transition-all duration-300 cursor-pointer flex items-center px-4 gap-5 overflow-hidden hover:shadow-[0_0_25px_5px_rgba(255,255,255,0.6)]`}
        onClick={handleClick}
        style={{backgroundColor: bgColor}}
      >
        <h2 className=" text-sm md:text-2xl text-white">{title}</h2>

        <img
          src={icon}
          alt={title}
          className="w-15 h-15 md:w-20 md:h-20 rounded-xl transform rotate-45 ml-auto translate-y-8"
        />
      </div>
    </div>
  );
};

const colors = [
  "#ffa500",
  "#dc143c",
  "#4682b4",
  "#301934",
  "#b06239",
  "#28a745",
  "#6f42c1",
];


const getRandomColor = () => {
  return colors[Math.floor(Math.random() * colors.length)];
};

export default FilterPage;
