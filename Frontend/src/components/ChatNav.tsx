import Logo from '../assets/logo.png';
import ProfileImage from '../components/profileimg';
import { ArrowLeft, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface NavbarProps {
  user:{username:string, userId:string | number};
  onDelete?: () => void;
}

const Navbar = ({ user, onDelete }: NavbarProps) => {
  const navigate = useNavigate();
  
  const handleBack = () => {
    // Pass the user when navigating back
    navigate("/", { state: { user } });
  };

  return (
    <nav className="bg-[#212121] text-white p-3 fixed w-full z-10 top-0">
      <div className="container mx-auto flex items-center px-4 md:px-10">
        <ArrowLeft
          className="mr-4 cursor-pointer flex-shrink-0"
          onClick={handleBack}
        />

        <div className="flex items-center flex-grow justify-center flex-1">
          <img src={Logo} alt="Logo icon" className="w-6 h-6 rounded-full" />
          <h1 className="text-2xl md:text-3xl font-mono font-bold tracking-wide ml-2 whitespace-nowrap">
            YinYang
          </h1>
        </div>

        <div className="flex items-center gap-3 ml-4">
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-2 hover:bg-red-600 rounded-full transition-colors"
              title="Delete Chat"
            >
              <Trash2 size={20} className="text-white" />
            </button>
          )}
          {user.username !== "guest" ? (
            <div className="flex justify-center items-center w-10 h-10 text-white font-bold text-lg rounded-full">
              <ProfileImage name={user.username} />
            </div>
          ) : (
            <button className="bg-[#212121] text-[#acacaf] px-2 md:px-3 py-1 md:py-2 rounded-md cursor-pointer hover:bg-[#2F2F2F] transition font-semibold text-sm md:text-base whitespace-nowrap">
              Login
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
